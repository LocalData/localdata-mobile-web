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

  // We request parcel shape data using tile names, even though they are not
  // rendered tiles. Since we're getting shape data, we can work with whatever
  // zoom level produces a convenient spatial chunk of data.
  var vectorTileZoom = 17;

  // Compute a list of tiles that cover the given bounds.
  function boundsToTiles(bounds) {
    // TODO: When we upgrade Leaflet, we can just use bounds.getSouth(), bounds.getEast(), etc.
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    return maptiles.getTileCoords(vectorTileZoom, [[sw.lng, sw.lat], [ne.lng, ne.lat]]);
  }


  var zoomLevels = {
    // Don't show parcels if we're zoomed out farther than 17.
    parcelCutoff: 17,
    // Don't indicate completed parcels if we're zoomed out farther than 17.
    completedCutoff: 17,
    // Don't show the checkmark completion markers if we're zoomed out farther
    // than 19.
    checkmarkCutoff: 19,
    // Buffer the area for which we request objects if we're zoomed in to 17 or
    // closer.
    bufferParcels: 18
  };

  return function (app, mapContainerId) {

    var map, marker;
    var circle = null;
    var markers = {};
    var numObjectsOnMap = 0;
    var parcelIdsOnTheMap = {};

    // DEBUG ONLY
    var addressesOnTheMap = {};
    // END DEBUG

    var parcelsLayerGroup = new L.LayerGroup();
    var doneMarkersLayer = new L.LayerGroup();
    var pointMarkersLayer = new L.LayerGroup();
    var completedParcelCount = 0;
    var completedParcelIds = {};
    var pendingParcelIds = {};

    var crosshairLayer;
    var pointObjectLayer;

    // var newPoint = null;
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
      iconUrl: 'js/lib/leaflet/images/marker-icon.png',
      shadowUrl: 'js/lib/leaflet/images/marker-shadow.png',
      iconSize: new L.Point(25, 41),
      shadowSize: new L.Point(41, 41),
      iconAnchor: new L.Point(12, 41),
      popupAnchor: new L.Point(25, 25)
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

    var pendingStyle = {
      opacity: 0.7,
      fillOpacity: 0.25,
      weight: 2,
      color: '#2ACCD4',
      fillColor: '#2ACCD4',
      dashArray: '1'
    };

    function parcelStyle(feature) {
      if (feature.properties.selected) {
        return selectedStyle;
      }
      if (_.has(completedParcelIds, feature.id)) {
        return completedStyle;
      }
      if (_.has(pendingParcelIds, feature.id)) {
        return pendingStyle;
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

              // DEBUG
              delete addressesOnTheMap[layer.feature.properties.address];

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

                // DEBUG
                delete addressesOnTheMap[layer.feature.properties.address];

                numObjectsOnMap -= 1;
              }
            });
          }
        });
      }
    }

    function mapAddress(e, address) {
      api.codeAddress(address, function (error, data) {
        if (error) {
          if (error.type === 'GeocodingError') {
            console.warn('We could not geocode the address: '  + address);
          } else {
            console.error('Unexpected error of type ' + error.type);
            console.error(error.message);
          }
          settings.address = '';
          return;
        }

        if (circle !== null) {
          map.removeLayer(circle);
        }

        // Add the accuracy circle to the map
        var radius = 4;
        var latlng = new L.LatLng(data.coords[1], data.coords[0]);
        circle = new L.Circle(latlng, radius);
        map.addLayer(circle);
        map.setView(latlng, 17);

        delete app.selectedObject;
        app.selectedObject = {
          centroid: {
            type: 'Point',
            coordinates: data.coords
          }
        };
      });
    }



    // Add a point to the map and open up the survey
    function addPoint() {
      // Deselect the previous layer, if any
      // if (newPoint !== null) {
      //   map.removeLayer(newPoint);
      // }

      var latlng = [map.getCenter().lat, map.getCenter().lng];
      var lnglat = [map.getCenter().lng, map.getCenter().lat];
      console.log("Moved point", latlng);

      // Keep track of the selected object centrally
      delete app.selectedObject;
      app.selectedObject = {};
      app.selectedObject.id = '';
      app.selectedObject.humanReadableName = 'Custom location';

      app.selectedObject.centroid = { coordinates: lnglat };
      app.selectedObject.geometry = {
        type: 'Point',
        coordinates: lnglat
      };

      // newPoint = L.marker(latlng, {icon: PlaceIcon});
      // map.addLayer(newPoint);

      // selectedLayer.setStyle(selectedStyle);

      // Let other parts of the app know that we've selected something.
      $.publish('objectSelected');
      }


    this.init = function() {
      console.log('Initializing map');
      map = L.map('map-div', {
        minZoom: 11,
        maxZoom: 19
      });

      map.addLayer(parcelsLayerGroup);
      map.addLayer(doneMarkersLayer);

      // Hack to show the map with JQuery mobile
      setTimeout(function(){
        map.invalidateSize();
      }, 0);

      // Add bing maps
      // var bing = new L.BingLayer(settings.bing_key, {maxZoom: 21, type:'AerialWithLabels'});
      // map.addLayer(bing);

      var  baseLayer = L.tileLayer('//a.tiles.mapbox.com/v3/matth.map-yyr7jb6r/{z}/{x}/{y}.png');
      map.addLayer(baseLayer);

      if (_.has(settings.survey, 'zones')) {
        var zoneLayer = new L.geoJson(settings.survey.zones, {
          style: zoneStyle
        });
        map.addLayer(zoneLayer);
      }

      // If this is a point-based survey, add a crosshair over null island
      if(settings.survey.type === 'point' ||
         settings.survey.type === 'pointandparcel') {

        if (settings.survey.type === 'point') {
          $('#location-header').html('');
        }

        crosshairLayer = L.marker([0,0], {
          icon: CrosshairIcon
        });
        map.addLayer(crosshairLayer)

        // Move the crosshairs as the map moves
        map.on('move', function() {
          crosshairLayer.setLatLng(map.getCenter());
        });

        map.on('moveend', function() {
          crosshairLayer.setLatLng(map.getCenter());
          addPoint();
        });

        map.on('click', function(event) {
          map.panTo(event.latlng);
          crosshairLayer.setLatLng(event.latlng);
        });

        // $('#point').show();
      } else if (settings.survey.type === 'address-point') {
        api.codeAddress(settings.survey.location, function (error, data) {
          if (error) {
            if (error.type === 'GeocodingError') {
              console.warn('We could not geocode the address: '  + settings.survey.location);
            } else {
              console.error('Unexpected error of type ' + error.type);
              console.error(error.message);
            }
            return;
          }
          crosshairLayer = L.marker([0,0], {icon: CrosshairIcon});
          map.addLayer(crosshairLayer);

          // Move the crosshairs as the map moves
          map.on('move', function(e){
            crosshairLayer.setLatLng(map.getCenter());
          });
        });

        $.subscribe('mapAddress', mapAddress);

        $('#geolocate').hide();
        $('#entry').show();
      }

      // Check for new responses when we submit
      $.subscribe('successfulSubmit', getResponsesInMap);

      // Show which parcels have responses when the map is moved.
      var lastBounds = null;
      map.on('moveend', _.debounce(function(event) {
        // Workaround. On Android Browser we sometimes get repeated moveend
        // events. If the bounds haven't changed, we shouldn't keep handling
        // the event.
        var bounds = null;
        try {
          bounds = map.getBounds();
        }
        catch (e) {  }

        // Avoid those duplicate moveend events
        if (lastBounds !== null && lastBounds.equals(bounds)) {
          return;
        }
        lastBounds = bounds;

        try {
          getResponsesInMap();
          renderParcelsInBounds();
        } catch(exception){

        }
      }, 50));

      // Mark a location on the map.
      // Primarily used with browser-based geolocation (aka 'where am I?')
      function onLocationFound(e) {
        initialLocate = false;
        // Remove the old circle if we have one
        if (circle !== null) {
          map.removeLayer(circle);
          circle = null;
        }

        // Add the accuracy circle to the map, unless it's huge.
        var radius = e.accuracy / 2;
        if (radius < 60) {
          circle = new L.Circle(e.latlng, radius);
          map.addLayer(circle);
        }
        map.setView(e.latlng, 19);

        getResponsesInMap();
        renderParcelsInBounds();
      }

      // Move the map ............................................................
      // Attempt to center the map on an address using Bing's geocoder.
      // This should probably live in APIs.
      var goToAddress = function(address) {
        $('#address-search-status').html("Searching for the address");
        $('#address-search-status').fadeIn(200);

        api.codeAddress(address, function (error, data) {
          $('#address-search-status').fadeOut(100);

          if (error) {
            if (error.type === 'GeocodingError') {
              console.warn('We could not geocode the address: '  + address);
            } else {
              console.error('Unexpected error of type ' + error.type);
              console.error(error.message);
            }
            settings.address = '';
            $('#address-search-status').html("Sorry, we weren't able to find that address");
            $('#address-search-status').fadeIn(100).fadeOut(5000);
            return;
          }

          if (circle !== null) {
            map.removeLayer(circle);
          }

          // Add the accuracy circle to the map
          var radius = 4;
          var latlng = new L.LatLng(data.coords[1], data.coords[0]);
          circle = new L.Circle(latlng, radius);
          map.addLayer(circle);
          map.setView(latlng, 19);

          // Record the address, for potential later use by the survey questions.
          settings.address = data.addressLine;

          // Close the panel
          $('#toolpanel').panel('close');
        });
      };

      /**
       * If geolocation fails, let the user know.
       */
      function onLocationError(e) {
        // Don't move the user to the default location if they
        // have already moved away from it.
        // TODO: We should just abstract and call the "goToAddress" code here
        if (initialLocate) {
          initialLocate = false;
          api.codeAddress(settings.survey.location, function (error, data) {
            if (error) {
              if (error.type === 'GeocodingError') {
                console.warn('We could not geocode the address: '  + settings.survey.location);
              } else {
                console.error('Unexpected error of type ' + error.type);
                console.error(error.message);
              }
              return;
            }

            if (circle !== null) {
              map.removeLayer(circle);
            }

            // Add the accuracy circle to the map
            var radius = 4;
            var latlng = new L.LatLng(data.coords[1], data.coords[0]);
            circle = new L.Circle(latlng, radius);
            map.addLayer(circle);
            map.setView(latlng, 19);
          });
        } else {
          console.error("Unexpected geoloation error", e);
        }
      }

      // Location handlers
      // Used for centering the map when we're using geolocation.
      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);

      var initialLocate = true; // is this our first attempt to locate?
      map.locate({
        setView: true,
        maxZoom: 19,
        enableHighAccuracy: true
      });

      // Map tools ...............................................................

      // Handle searching for addresses
      $('#address-submit').click(function(){
        goToAddress($('#address-input').val());
      });

      $('#geolocate').click(function(){
        map.locate({
          setView: false,
          enableHighAccuracy: true
        });
      });

      $('#entry').click(function () {
        app.selectedObject = {};

        // Indicate that we're ready for a form
        $.publish('readyForAddressForm');
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

      // If there is an address associated with the selected object, save that.
      // TODO: For now, if the survey type is "address", we assume the object
      // name indicates the address.
      // TODO: This is Houston-specific for beta testing.
      if (settings.survey.type === 'address') {
        var address = selectedLayer.feature.properties.address;
        var city = 'houston';
        if (address.length > city.length && address.substr(address.length - city.length).toLocaleLowerCase() === city) {
          app.selectedObject.address = address.substr(0, address.length - city.length - 1).titleCase();
        }
      }

      // Let other parts of the app know that we've selected something.
      $.publish('objectSelected');
    }

    // Render parcels that are currently visible in the map
    // Gets geodata from our api
    function renderParcelsInBounds() {
      console.log('Map: getting & rendering features in bounds');
      // Don't load and render a basemap if the survey is point-based
      if (settings.survey.type === 'point' || settings.survey.type === 'address-point') {
        return;
      }

      // Don't add any parcels if the zoom is really far out.
      var zoom = map.getZoom();
      if(zoom < zoomLevels.parcelCutoff) {
        // Clear out the parcels. An odd group of leftover parcels looks
        // confusing.
        parcelsLayerGroup.clearLayers();
        parcelIdsOnTheMap = {};

        // DEBUG
        addressesOnTheMap = {};

        numObjectsOnMap = 0;
        return;
      }

      var bounds = map.getBounds();
      if (zoom >= zoomLevels.bufferParcels) {
        bounds = addBuffer(bounds);
      }

      // TODO: Loading
      // $.mobile.showPageLoadingMsg();

      // Decide which function we use to get the base layer
      var options = {};
      var getParcels = api.getObjectsInBBox;
      if(_.has(settings.survey, 'geoObjectSource')) {
        if (settings.survey.geoObjectSource.type === 'ArcGIS Server') {
          getParcels = api.getObjectsInBBoxFromESRI;
          options = settings.survey.geoObjectSource;
        }
        if (settings.survey.geoObjectSource.type === 'LocalData') {
          getParcels = api.getObjectsInBBoxFromLocalData;
          options = settings.survey.geoObjectSource;
        }
      }

      // Compute the tiles that we need to cover the current map bounds.
      var tiles = boundsToTiles(bounds);

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
              // TODO
              // $.mobile.hidePageLoadingMsg();
            }
            console.log(error.message);
            // TODO: we should subscribe to the 'online' event and refetch
            // parcels if appropriate
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
            console.log("We have some results!");
            if (parcelIdsOnTheMap[feature.id]) {
              return false;
            }

            var centroidString = String(feature.properties.centroid.coordinates[0]) +
                                 String(feature.properties.centroid.coordinates[1]);
            //console.log(centroidString, feature.properties);
            // DEBUG
            if (addressesOnTheMap[centroidString]) {
             // console.log("Skipping", feature.properties.address);
              return false;
            }

            addressesOnTheMap[centroidString] = 1;

            //console.log("Adding", feature.properties);
            return true;
          });

          // Create a new GeoJSON layer and style it.
          var geoJSONLayer = new L.geoJson(featureCollection, {
            style: parcelStyle,
            pointToLayer: function (feature, latlng) {
              return L.circleMarker(latlng);
            }
          });

          // Add click handler
          geoJSONLayer.on('click', selectParcel);

          // Add the layer to the layergroup.
          parcelsLayerGroup.addLayer(geoJSONLayer);

          // Track the parcels that we've added.
          _.each(featureCollection.features, function (feature) {
            parcelIdsOnTheMap[feature.id] = geoJSONLayer;

            // DEBUG
            addressesOnTheMap[feature.properties.address] = 1;
          });
          numObjectsOnMap += featureCollection.features.length;

          // TODO: If we use promises, we can use something like Q.all, instead
          // of counting this ourselves.
          loadingCount -= 1;
          if (loadingCount === 0) {
            // Hide the spinner
            // TODO
            // $.mobile.hidePageLoadingMsg();
          }
        });
      });

      // Clean up parcels while we wait for the remote data.
      cleanupParcels(bounds);
    }

    // Adds a checkbox marker to the given point
    function addDoneMarker(latlng, id) {
      // Only add markers if they aren't already on the map.
      if (markers[id] === undefined  || id === ''){
        var doneIcon = new CheckIcon();
        var doneMarker = new L.Marker(latlng, {icon: doneIcon});
        doneMarkersLayer.addLayer(doneMarker);
        markers[id] = doneMarker;
      }
    }

    // Flag existing responses, so we can style them appropriately on the map.
    function markResponses(responses, type) {
      if (type === 'pending') {
        pendingParcelIds = {};
      } else if (type === 'completed') {
        // TODO: This should be greater than the maximum number of completed
        // parcels we expect to display on the screen at one time.
        if (completedParcelCount > 15000) {
          completedParcelIds = {};
          completedParcelCount = 0;
        }
      }

      var zoom = map.getZoom();

      _.each(responses, function (response) {
        var parcelId = response.parcel_id;
        var treatAsPoint = response.geo_info.geometry.type === 'Point';
        var zoomCutoffMet = (zoom >= zoomLevels.checkmarkCutoff && settings.survey.type !== 'address');

        // For address-based surveys, the checkmarks can be misleading, since
        // they will correspond to lots/parcels and not individual units.
        if (zoomCutoffMet || treatAsPoint) {
          var point = new L.LatLng(response.geo_info.centroid[1], response.geo_info.centroid[0]);
          addDoneMarker(point, parcelId);
        }

        if (parcelId !== undefined) {
          if (type === 'completed') {
            completedParcelIds[parcelId] = true;
            completedParcelCount += 1;
          } else if (type === 'pending') {
            pendingParcelIds[parcelId] = true;
          }
        }
      });
    }

    // Get all the responses in a map
    function getResponsesInMap() {
      console.log('Getting responses in the map');
      // Unsubscribe to the syncedResponses event. We'll resubscribe later if
      // it's appropriate.
      $.unsubscribe('syncedResponses', getResponsesInMap);

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
      if (zoom < zoomLevels.checkmarkCutoff && (
          settings.survey.type !== 'point' &&
          settings.survey.type !== 'pointandparcel' &&
          settings.survey.type !== 'address-point'
        ) ) {
        doneMarkersLayer.clearLayers();
        markers = [];
      }

      var bounds = map.getBounds();
      if (zoom >= zoomLevels.bufferParcels) {
        bounds = addBuffer(bounds);
      }

      // Debounce the restyling code, in case we get data tiles in quick
      // succession.
      var restyle = _.debounce(function () {
        parcelsLayerGroup.eachLayer(function (layer) {
          layer.setStyle(parcelStyle);
        });
      }, 200);

      // For now we assume there are not many saved responses, so we can just grab them all.
      api.getSavedResponses(function (error, pendingResponses) {
        // We're refetching everything in the visible map area, so we can
        // safely throw away the old IDs.
        completedParcelIds = {};
        completedParcelCount = 0;
        if (!error) {
          markResponses(pendingResponses, 'pending');
          if (pendingResponses.length > 0) {
            restyle();
          }
        }

        // Compute the tiles that we need to cover the current map bounds.
        var tiles = boundsToTiles(bounds);

        var loadingCount = tiles.length;

        // When we're done with all of the tiles, restyle and wrap things up.
        function doneLoadingResponseTile() {
          loadingCount -= 1;
          if (loadingCount > 0) {
            return;
          }

          if (pendingResponses.length > 0) {
            // When the pending responses are synced, we want to get new
            // response data and refresh the map.
            $.subscribe('syncedResponses', getResponsesInMap);
          }
        }

        // Fetch each tile.
        _.each(tiles, function (tile) {
          api.getResponsesInBBox(maptiles.tileToBBox(tile), function (completedResponses) {

            markResponses(completedResponses, 'completed');
            // If we got responses, we need to restyle, so they show up.
            if (completedResponses.length > 0) {
              restyle();
            }
            // We're done with this tile.
            doneLoadingResponseTile();
          });
        });
      });

    }

    // Map init ================================================================
    this.init();
  };
});
