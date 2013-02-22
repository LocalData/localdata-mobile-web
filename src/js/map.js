/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/underscore');
  var settings = require('settings');
  var api = require('api');
  var L = require('lib/leaflet');
  var maptiles = require('maptiles');

  // Add a buffer to a bounds object.
  // Makes parcels render faster when the map is moved
  function addBuffer(bounds, divisor) {
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    
    var lngDiff = ne.lng - sw.lng;
    var latDiff = ne.lat - sw.lat;
    
    var lngMod = lngDiff / 4;
    var latMod = latDiff / 4;
    
    var newSW = new L.LatLng(sw.lat - latMod, sw.lng - lngMod);
    var newNE = new L.LatLng(ne.lat + latMod, ne.lng + lngMod);
    
    return new L.LatLngBounds(newSW, newNE);
  }

  function computeRingCentroid(ring) {
    var off = ring[0];
    var twiceArea = 0;
    var x = 0;
    var y = 0;
    var nPoints = ring.length;
    var p1, p2;
    var f;

    var i, j;
    for (i = 0, j = nPoints - 1; i < nPoints; j = i, i += 1) {
      p1 = ring[i];
      p2 = ring[j];
      f = (p1[1] - off[1]) * (p2[0] - off[0]) - (p2[1] - off[1]) * (p1[0] - off[0]);
      twiceArea += f;
      y += (p1[1] + p2[1] - 2 * off[1]) * f;
      x += (p1[0] + p2[0] - 2 * off[0]) * f;
    }
    f = twiceArea * 3;
    return [x / f + off[0], y / f + off[1]];
  }

  // Compute the centroid of a geometry.
  function computeCentroid(geometry) {
    if (geometry.type === 'MultiPolygon') {
      // TODO: For now we only handle the first polygon.
      return computeRingCentroid(geometry.coordinates[0][0]);
    }

    if (geometry.type === 'Polygon') {
      // TODO: For now we only handle the exterior ring.
      return computeRingCentroid(geometry.coordinates[0]);
    }

    if (geometry.type === 'Point') {
      return _.clone(geometry.coordinates);
    }

    return null;
  }

  var zoomLevels = {
    // Don't show parcels if we're zoomed out farther than 16.
    parcelCutoff: 16,
    // Don't indicate completed parcels if we're zoomed out farther than 16.
    completedCutoff: 16,
    // Don't show the checkmark completion markers if we're zoomed out farther
    // than 19.
    checkmarkCutoff: 19,
    // Buffer the area for which we request objects if we're zoomed in to 17 or
    // closer.
    bufferParcels: 17
  };

  // We request parcel shape data using tile names, even though they are not
  // rendered tiles. Since we're getting shape data, we can work with whatever
  // zoom level produces a convenient spatial chunk of data.
  var vectorTileZoom = 17;

  return function (app, mapContainerId) {

    var map, marker, circle;
    var markers = {};
    var numObjectsOnMap = 0;
    var parcelIdsOnTheMap = {};
    var parcelsLayerGroup = new L.LayerGroup();
    var doneMarkersLayer = new L.LayerGroup();
    var pointMarkersLayer = new L.LayerGroup();
    var completedParcelCount = 0;
    var completedParcelIds = {};

    var crosshairLayer;
    var pointObjectLayer;

    var newPoint = null;
    var selectedLayer = null;
    var selectedPolygon = null;
    var selectedCentroid = null;
    var selectedObjectJSON = null;


    // Icons ...................................................................
    var CheckIcon = L.Icon.extend({
      options: {
        className: 'CheckIcon',
        iconUrl: 'img/icons/check-16.png',
        shadowUrl: 'img/icons/check-16.png',
        iconSize: new L.Point(16, 16),
        shadowSize: new L.Point(16, 16),
        iconAnchor: new L.Point(8, 8),
        popupAnchor: new L.Point(8, 8)
      }
    });  

    var PlaceIcon = L.icon({
      className: 'PlaceIcon',
      iconUrl: 'img/icons/plus-24.png',
      shadowUrl: 'img/icons/plus-24.png',
      iconSize: new L.Point(25, 25),
      shadowSize: new L.Point(25, 25),
      iconAnchor: new L.Point(13, 13),
      popupAnchor: new L.Point(13, 13)
    });  

    var CrosshairIcon = L.icon({
      className: 'CrosshairIcon',
      iconUrl: 'img/icons/crosshair.png',
      shadowUrl: 'img/icons/crosshair.png',
      iconSize: new L.Point(141, 141),
      shadowSize: new L.Point(141, 141),
      iconAnchor: new L.Point(71, 71),
      popupAnchor: new L.Point(71, 71)
    });


    // Styles for parcel outlines ..............................................
    var defaultStyle = {
      'opacity': 1,
      'fillOpacity': 0,
      'weight': 2,
      'color': 'white',
      'dashArray': '5,5'
    };

    var selectedStyle = {
      'opacity': 1,
      'fillOpacity': 0.25,
      'weight': 3,
      'color': 'yellow',
      'fillColor': 'yellow',
      'dashArray': '1'
    };

    var completedStyle = {
      opacity: 0.7,
      fillOpacity: 0.25,
      weight: 2,
      color: '#2AD471',
      fillColor: '#2AD471',
      dashArray: '1'
    };

    function parcelStyle(feature) {
      if (feature.properties.selected) {
        return selectedStyle;
      }
      if (_.has(completedParcelIds, feature.id)) {
        return completedStyle;
      }
      return defaultStyle;
    }

    function zoneStyle(feature) {
      return {
        color: feature.properties.color,
        opacity: 0.75,
        fillColor: feature.properties.color,
        fillOpacity: 0.1,
        weight: 3
      };
    }

    function cleanupParcels(bounds) {
      // If we have too many objects, let's delete the ones outside of the new view + buffer.
      if(numObjectsOnMap > 200) {
        var groupCount = 0;
        parcelsLayerGroup.eachLayer(function (group) {
          groupCount += 1;
          var groupBounds = group.getBounds();
          // TODO: Checking groupBounds._southWest is a bit of a hack. I think
          // the latest leaflet handles this better.
          if (groupBounds._southWest === undefined || !bounds.intersects(groupBounds)) {
            group.eachLayer(function (layer) {
              if (completedParcelIds[layer.feature.id] !== undefined) {
                delete completedParcelIds[layer.feature.id];
                completedParcelCount -= 1;
              }
              delete parcelIdsOnTheMap[layer.feature.id];
              numObjectsOnMap -= 1;
            });
            parcelsLayerGroup.removeLayer(group);
          } else {
            group.eachLayer(function (layer) {
              if (!bounds.intersects(layer.getBounds())) {
                group.removeLayer(layer);

                if (completedParcelIds[layer.feature.id] !== undefined) {
                  delete completedParcelIds[layer.feature.id];
                  completedParcelCount -= 1;
                }
                delete parcelIdsOnTheMap[layer.feature.id];
                numObjectsOnMap -= 1;
              }
            });
          }
        });
      }
    }

    this.init = function() {
      console.log('Initialize map');
      console.log(settings.survey);
      map = new L.Map(mapContainerId, {minZoom:11, maxZoom:21});

      map.addLayer(parcelsLayerGroup);
      map.addLayer(doneMarkersLayer);

      // Add bing maps
      var bing = new L.BingLayer(settings.bing_key, {maxZoom:21, type:'AerialWithLabels'});
      map.addLayer(bing);

      if (_.has(settings.survey, 'zones')) {
        var zoneLayer = new L.geoJson(settings.survey.zones, {
          style: zoneStyle
        });
        map.addLayer(zoneLayer);
      }

      // If this is a point-based survey, add a crosshair over null island 
      if(settings.survey.type === 'point') {
        crosshairLayer = L.marker([0,0], {icon: CrosshairIcon});
        map.addLayer(crosshairLayer);

        // Move the crosshairs as the map moves
        map.on('move', function(e){
          crosshairLayer.setLatLng(map.getCenter());
        });

        $('#point').show();
      }

      $.subscribe('successfulSubmit', getResponsesInMap);    

      // Show which parcels have responses when the map is moved.
      map.on('moveend', function(event) {
        try {
          getResponsesInMap();
          renderParcelsInBounds();
        } catch(exception){

        }
      });


      // Location handlers
      // Used for centering the map when we're using geolocation.
      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);

      map.locate({
        setView: true,
        maxZoom: 19,
        enableHighAccuracy: true
      });

      // Mark a location on the map. 
      // Primarily used with browser-based geolocation (aka 'where am I?')
      function onLocationFound(e) {
        // Remove the old circle if we have one
        if (circle !== undefined) {
          map.removeLayer(circle);
        }

        // Add the accuracy circle to the map
        var radius = e.accuracy / 2;
        circle = new L.Circle(e.latlng, radius);
        map.addLayer(circle);

        getResponsesInMap();
        renderParcelsInBounds();
      }

      function onLocationError(e) {
        alert(e.message);
      }


      // Map tools ...............................................................

      // Handle searching for addresses
      $('#address-search-toggle').click(function(){
        $('#address-search').slideToggle();
        $('#address-search-prompt').slideToggle();
      });

      $('#address-submit').click(function(){
        goToAddress($('#address-input').val());
      });

      $('#geolocate').click(function(){
        map.locate({
          setView: false,
          enableHighAccuracy: true
        });
      });

      // Add a point to the map and open up the survey
      $('#point').click(function() {
        // Deselect the previous layer, if any
        if (newPoint !== null) {
          map.removeLayer(newPoint);
        }

        var latlng = [map.getCenter().lat, map.getCenter().lng];
        var lnglat = [map.getCenter().lng, map.getCenter().lat];

        // Keep track of the selected object centrally
        app.selectedObject.id = '';
        app.selectedObject.humanReadableName = 'Custom location';
        app.selectedObject.centroid = { coordinates: lnglat };

        // Select the current layer

        newPoint = L.marker(latlng, {icon: PlaceIcon});
        map.addLayer(newPoint);

        // selectedLayer.setStyle(selectedStyle);

        // Let other parts of the app know that we've selected something.
        $.publish('objectSelected');

      });

    }; // end init


    // Map information used by other parts of the app ..........................

    this.getSelectedCentroid = function() {
      return app.selectedObject.centroid;
    };

    // Return the bounds of the map as a string
    this.getMapBounds = function() {
      var bounds = '';
      bounds += map.getBounds().getNorthWest().toString();
      bounds += ' ' + map.getBounds().getSouthEast().toString();  
      return bounds;
    };


    // Move the map ............................................................
    // Attempt to center the map on an address using Google's geocoder.
    // This should probably live in APIs. 
    var goToAddress = function(address) {
      api.codeAddress(address, function(latlng){
        if (circle !== undefined) {
          map.removeLayer(circle);
        }

        // Add the accuracy circle to the map
        var radius = 4;
        circle = new L.Circle(latlng, radius);
        map.addLayer(circle);
        map.setView(latlng, 19);

        // Scroll to the top so users can 
        window.scrollTo(0,0);
        $('#address-search').slideToggle();
        $('#address-search-prompt').slideToggle();


      });
    };

    function selectParcel(event) {
      var oldSelectedLayer = selectedLayer;

      // Select the current layer
      selectedLayer = event.layer;

      if (oldSelectedLayer !== null) {
        oldSelectedLayer.feature.properties.selected = false;
      }
      selectedLayer.feature.properties.selected = true;

      // Restyle the parcels
      parcelsLayerGroup.eachLayer(function (layer) {
        layer.setStyle(parcelStyle);
      });
      
      // Keep track of the selected object centrally
      app.selectedObject.id = selectedLayer.feature.id;
      app.selectedObject.humanReadableName = selectedLayer.feature.properties.address;

      if (selectedLayer.feature.properties.centroid !== undefined) {
        app.selectedObject.centroid = selectedLayer.feature.properties.centroid;
      } else {
        app.selectedObject.centroid = {
          type: 'Point',
          coordinates: computeCentroid(selectedLayer.feature.geometry)
        };
      }

      app.selectedObject.geometry = selectedLayer.feature.geometry; 

      // Let other parts of the app know that we've selected something.
      $.publish('objectSelected');
    }

    // Render parcels that are currently visible in the map
    // Gets geodata from our api
    function renderParcelsInBounds() {
      console.log('Map: getting & rendering parcels in bounds');

      // Don't load and render a basemap if the survey is point-based
      if (settings.survey.type === 'point') {
        return;
      }
 
      // Don't add any parcels if the zoom is really far out. 
      var zoom = map.getZoom();
      if(zoom < zoomLevels.parcelCutoff) {
        // Clear out the parcels. An odd group of leftover parcels looks
        // confusing.
        parcelsLayerGroup.clearLayers();
        parcelIdsOnTheMap = {};
        numObjectsOnMap = 0;
        return;
      }

      var bounds = map.getBounds();
      if (zoom >= zoomLevels.bufferParcels) {
        bounds = addBuffer(bounds);
      }

      $.mobile.showPageLoadingMsg();

      // Decide which function we use to get the base layer
      var options = {};
      var getParcels = api.getObjectsInBBox;
      if(_.has(settings.survey, 'geoObjectSource')) {
        if (settings.survey.geoObjectSource.type === 'ArcGIS Server') {
          getParcels = api.getObjectsInBBoxFromESRI;
          options = settings.survey.geoObjectSource;
        }
      }

      // Compute the tiles that we need to cover the current map bounds.
      // TODO: When we upgrade Leaflet, we can just use bounds.getSouth(), bounds.getEast(), etc.
      var sw = bounds.getSouthWest();
      var ne = bounds.getNorthEast();
      var tiles = maptiles.getTileCoords(vectorTileZoom, [[sw.lng, sw.lat], [ne.lng, ne.lat]]);
      // Fetch each tile.
      var loadingCount = tiles.length;
      _.each(tiles, function (tile) {
        getParcels(maptiles.tileToBBox(tile), options, function (error, result) {
          if (error) {
            // TODO: If we use promises, we can use something like Q.all, instead
            // of counting this ourselves.
            loadingCount -= 1;
            if (loadingCount === 0) {
              // Hide the spinner
              $.mobile.hidePageLoadingMsg();
            }
            console.log(error.message);
            return;
          }

          var featureCollection = {
            type: 'FeatureCollection'
          };

          // When parcels cross tile boundaries, we'll have duplicates. This
          // filters those out, so we don't actually plot duplicates on the
          // map. That means that some of our local parcel tiles will be
          // incomplete. As we move the map around, we technically go through
          // the full set of parcels again to see which ones to plot. That
          // should restore any parcels that were clipped because they were
          // once duplicated in other tiles.
          featureCollection.features = _.filter(result.features, function (feature) {
            if (parcelIdsOnTheMap[feature.id]) {
              return false;
            }
            return true;
          });

          // Create a new GeoJSON layer and style it. 
          var geoJSONLayer = new L.geoJson(featureCollection, {
            style: parcelStyle
          });

          // Add click handler
          geoJSONLayer.on('click', selectParcel);

          // Add the layer to the layergroup.
          parcelsLayerGroup.addLayer(geoJSONLayer);

          // Track the parcels that we've added.
          _.each(featureCollection.features, function (feature) {
            parcelIdsOnTheMap[feature.id] = geoJSONLayer;
          });
          numObjectsOnMap += featureCollection.features.length;

          // TODO: If we use promises, we can use something like Q.all, instead
          // of counting this ourselves.
          loadingCount -= 1;
          if (loadingCount === 0) {
            // Hide the spinner
            $.mobile.hidePageLoadingMsg();
          }
        });
      });

      // Clean up parcels while we wait for the remote data.
      cleanupParcels(bounds);
    }

    // Adds a checkbox marker to the given point
    var addDoneMarker = function(latlng, id) {
      // Only add markers if they aren't already on the map.
      if (markers[id] == undefined  || id === ''){
        var doneIcon = new CheckIcon();
        var doneMarker = new L.Marker(latlng, {icon: doneIcon});
        doneMarkersLayer.addLayer(doneMarker);
        markers[id] = doneMarker;
      }
    };

    // Get all the responses in a map 
    var getResponsesInMap = function () {  
      console.log('Getting responses in the map');

      // Don't add any markers if the zoom is really far out. 
      var zoom = map.getZoom();
      if(zoom < zoomLevels.completedCutoff) {
        completedParcelIds = {};
        completedParcelCount = 0;

        doneMarkersLayer.clearLayers();
        markers = [];
        return;
      }

      // When zoomed out a bit, just color the completed parcels, don't show
      // checkmarks. Of course, for point-based surveys, we always want checkmarks.
      if (zoom < zoomLevels.checkmarkCutoff && settings.survey.type !== 'point') {
        doneMarkersLayer.clearLayers();
        markers = [];
      }

      var bounds = map.getBounds();
      if (zoom >= zoomLevels.bufferParcels) {
        bounds = addBuffer(bounds);
      }

      // TODO: make these requests according to tile boundaries
      api.getResponsesInBounds(bounds, function (results) {
        // TODO: This should be greater than the maximum number of completed
        // parcels we expect to display on the screen at one time.
        if (completedParcelCount > 2000) {
          completedParcelIds = {};
          completedParcelCount = 0;
        }

        // Track the responses that we've added.
        _.each(results, function (response) {
          var parcelId = response.geo_info.parcel_id;

          if (zoom >= zoomLevels.checkmarkCutoff) {
            var point = new L.LatLng(response.geo_info.centroid[1], response.geo_info.centroid[0]);
            addDoneMarker(point, parcelId);
          }

          if (parcelId !== undefined) {
            completedParcelIds[parcelId] = true;
            completedParcelCount += 1;
          }
        });

        if (results.length > 0) {
          parcelsLayerGroup.eachLayer(function (layer) {
            layer.setStyle(parcelStyle);
          });
        }
      });

    };

    // Map init ================================================================
    this.init();
  };
});
