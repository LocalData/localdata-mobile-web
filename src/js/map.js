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

    var map;
    var circle = null;
    var markers = {};
    var numObjectsOnMap = 0;
    var parcelIdsOnTheMap = {}; // Used for preventing duplicate shapes
    var addressesOnTheMap = {}; // More sophisticated dupe prevention

    var parcelsLayerGroup = new L.LayerGroup();
    var doneMarkersLayer = new L.LayerGroup();
    var completedParcelCount = 0;
    var completedParcelIds = {};
    var freshParcelIds = {};
    var pendingParcelIds = {};

    var crosshairLayer;

    var selectedLayer = null;

    // Styles for parcel outlines and other base features ......................
    function featureStyle(feature) {
      var geometryType = feature.geometry.type;
      var type;

      if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
        type = 'polygon';
      } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
        type = 'lineString';
      } else if (geometryType === 'Point') {
        type = 'point';
      }else {
        console.err('Unknown geometry type: ' + geometryType);
        type = 'polygon';
      }

      if (feature.properties.selected) {
        return settings.styles.selected[type];
      }

      if (_.has(completedParcelIds, feature.id)) {

        // We mark stale parcels when requested by the survey
        if (settings.survey.responseLongevity &&
            !_.has(freshParcelIds, feature.id)) {
          return settings.styles.stale[type];
        }

        return settings.styles.completed[type];
      }

      if (_.has(pendingParcelIds, feature.id)) {
        return settings.styles.pending[type];
      }

      return settings.styles.default[type];
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
                delete freshParcelIds[layer.feature.id];
                completedParcelCount -= 1;
              }
              delete parcelIdsOnTheMap[layer.feature.id];

              // DEBUG
              var centroidString = String(layer.feature.properties.centroid.coordinates[0]) +
                                   ',' +
                                   String(layer.feature.properties.centroid.coordinates[1]);
              delete addressesOnTheMap[centroidString];

              numObjectsOnMap -= 1;
            });
            parcelsLayerGroup.removeLayer(group);
          } else {
            group.eachLayer(function (layer) {
              if (!bounds.intersects(layer.getBounds())) {
                group.removeLayer(layer);

                if (completedParcelIds[layer.feature.id] !== undefined) {
                  delete completedParcelIds[layer.feature.id];
                  delete freshParcelIds[layer.feature.id];
                  completedParcelCount -= 1;
                }
                delete parcelIdsOnTheMap[layer.feature.id];

                var centroidString = String(layer.feature.properties.centroid.coordinates[0]) +
                                     ',' +
                                     String(layer.feature.properties.centroid.coordinates[1]);
                delete addressesOnTheMap[centroidString];

                numObjectsOnMap -= 1;
              }
            });
          }
        });
      }
    }

    function mapAddress(e, address) {
      api.geocodeAddress(address, function (error, data) {
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
        circle = new L.Circle(latlng, radius, {
          clickable: false
        });
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


    function objectSelected(feature, scroll) {
      var visibleHeight = 200;

      // TODO: implement a page controller/view-model that listens to the map's
      // selection events and coordinates movement/display of the map and form.

      var mapDiv = $('#map-div');
      var height = mapDiv.height();
      var offset;

      if (scroll) {
        if (app.crosshairLayer) {
          // If the map is in point-selection mode, then we want to slide most of
          // the map out of view but keep the point marker visible.

          var middle = mapDiv.position().top + (height / 2);
          offset = middle - app.crosshairLayer.options.icon.options.iconAnchor.y;
          $('body').animate({ scrollTop: offset });

        } else {
          // If the map is in object-selection mode, then we want to slide most of
          // the map out of view and pan the map, so the selected object is still
          // visible.

          // Pan the map out of the way
          var bottom = mapDiv.position().top + height;
          offset = bottom - visibleHeight;
          $('body').animate({ scrollTop: offset });

          // Pan the map so the selected object is still in view
          // We want the centroid to fit into the bottom portion of the map (visibleHeight).
          var center = map.project(L.latLng(feature.centroid.coordinates[1], feature.centroid.coordinates[0]));
          center.y -= (height/2 - visibleHeight/2);
          map.panTo(map.unproject(center), {
            animate: false,
          });
        }
      }

      $.publish('objectSelected');
    }

    // Add a point to the map and open up the survey
    function addPoint(scroll) {
      // Deselect the previous layer, if any
      // if (newPoint !== null) {
      //   map.removeLayer(newPoint);
      // }

      var lnglat = [map.getCenter().lng, map.getCenter().lat];

      // Keep track of the selected location
      delete app.selectedObject;
      app.selectedObject = {};
      app.selectedObject.id = '';
      app.selectedObject.humanReadableName = 'Custom location';
      app.selectedObject.centroid = { coordinates: lnglat };
      app.selectedObject.geometry = {
        type: 'Point',
        coordinates: lnglat
      };

      // Try to find a better name for the location.
      api.reverseGeocode(lnglat[0], lnglat[1], function (error, location) {
        if (error) {
          console.error(error);
        }

        if (location) {
          app.selectedObject.humanReadableName = 'Near ' + location.shortName;
        }

        // Let the app know that we've selected something.
        objectSelected(app.selectedObject, scroll);
      });
    }

    function crosshairMove() {
      app.crosshairLayer.setLatLng(map.getCenter());
    }

    function crosshairMoveEnd() {
      app.crosshairLayer.setLatLng(map.getCenter());
      addPoint(false);
    }

    function crosshairMapClick(event) {
      map.panTo(event.latlng);
      app.crosshairLayer.setLatLng(event.latlng);
      addPoint(true);
    }

    // Show the add / remove point interface
    function showPointInterface() {
      crosshairLayer = L.marker([0,0], {
        icon: settings.icons.CrosshairIcon
      });
      map.addLayer(crosshairLayer);
      app.crosshairLayer = crosshairLayer;

      // Move the crosshairs as the map moves
      map.on('move', crosshairMove);
      map.on('dragend', crosshairMoveEnd);
      map.on('click', crosshairMapClick);
    }

    function hidePointInterface (argument) {
      map.removeLayer(app.crosshairLayer);
      map.off('move', crosshairMove);
      map.off('dragend', crosshairMoveEnd);
      map.off('click', crosshairMapClick);
      app.crosshairLayer = null;
    }

    function showPointParcelInterface() {
      $('#pointparcelswitch').show();

      $('#radio-choice-point').click(function() {
        showPointInterface();
      });
      $('#radio-choice-parcel').click(function() {
        hidePointInterface();
      });
    }

    function setupAddressPointSurvey() {
      api.geocodeAddress(settings.survey.location, function (error, data) {
        if (error) {
          if (error.type === 'GeocodingError') {
            console.warn('We could not geocode the address: '  + settings.survey.location);
          } else {
            console.error('Unexpected error of type ' + error.type);
            console.error(error.message);
          }
          return;
        }
        crosshairLayer = L.marker([0,0], {icon: settings.icons.CrosshairIcon});
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
      var bing = new L.BingLayer(settings.bing_key, {maxZoom: 21, type:'AerialWithLabels'});
      map.addLayer(bing);

      // var  baseLayer = L.tileLayer('//a.tiles.mapbox.com/v3/matth.map-yyr7jb6r/{z}/{x}/{y}.png');
      // map.addLayer(baseLayer);

      // Check for new responses when we submit
      $.subscribe('successfulSubmit', getResponsesInMap);

      // Set up zones, if any
      if (_.has(settings.survey, 'zones')) {
        var zoneLayer = new L.geoJson(settings.survey.zones, {
          style: zoneStyle
        });
        map.addLayer(zoneLayer);
      }

      // If this is a point-based survey, add a crosshair over null island
      if(settings.survey.type === 'point') {
        showPointInterface();
      }

      // Set up address-point surveys, if any
      if (settings.survey.type === 'address-point') {
        setupAddressPointSurvey();
      }

      if (settings.survey.type === 'pointandparcel') {
        showPointParcelInterface();
        console.log("POINT AND PARCEL SURVEY");
      }

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
          circle = new L.Circle(e.latlng, radius, {
            clickable: false
          });
          map.addLayer(circle);
          circle.bringToBack();
        }
        map.setView(e.latlng, 19);

        getResponsesInMap();
        renderParcelsInBounds();
      }

      // Move the map ............................................................
      // Attempt to center the map on an address.
      // Delegate the actual geocoding to the API module.
      function goToAddress(address) {
        $('#address-search-status').html("Searching for the address");
        $('#address-search-status').fadeIn(200);

        api.geocodeAddress(address, function (error, data) {
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
          circle = new L.Circle(latlng, radius, {
            clickable: false
          });
          map.addLayer(circle);
          map.setView(latlng, 19);

          // Record the address, for potential later use by the survey questions.
          settings.address = data.addressLine;

          // Close the panel
          $('#toolpanel').panel('close');
        });
      }

      /**
       * If geolocation fails, let the user know.
       */
      function onLocationError(e) {
        // Don't move the user to the default location if they
        // have already moved away from it.
        // TODO: We should just abstract and call the "goToAddress" code here
        if (initialLocate) {
          initialLocate = false;
          api.geocodeAddress(settings.survey.location, function (error, data) {
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
            circle = new L.Circle(latlng, radius, {
              clickable: false
            });
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
        layer.setStyle(featureStyle);
      });

      // Keep track of the selected object centrally
      app.selectedObject.id = selectedLayer.feature.id;

      app.selectedObject.humanReadableName =
        selectedLayer.feature.properties.address || // parcels endpoint
        selectedLayer.feature.properties.shortName; // features endpoint

      // Store the human-readable name (often the address).
      if (_.has(selectedLayer.feature.properties, 'address')) {
        app.selectedObject.humanReadableName = selectedLayer.feature.properties.address;
      } else if (_.has(selectedLayer.feature.properties, 'shortName')) {
        app.selectedObject.humanReadableName = selectedLayer.feature.properties.shortName;
      } else {
        app.selectedObject.humanReadableName = 'Unknown Location';
      }

      // Store the centroid.
      if (selectedLayer.feature.properties.centroid !== undefined) {
        app.selectedObject.centroid = selectedLayer.feature.properties.centroid;
      } else {
        app.selectedObject.centroid = {
          type: 'Point',
          coordinates: computeCentroid(selectedLayer.feature.geometry)
        };
      }

      // If the base feature has other info properties, store those.
      if (selectedLayer.feature.properties.info !== undefined) {
        app.selectedObject.info = selectedLayer.feature.properties.info;
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
      objectSelected(app.selectedObject, true);
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
            // if (loadingCount === 0) {
            //   // Hide the spinner
            //   // TODO
            //   // $.mobile.hidePageLoadingMsg();
            // }
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
            if (parcelIdsOnTheMap[feature.id]) {
              return false;
            }

            // Don't render duplicate shapes
            // Use the object centroid as a method for ensuring
            // var centroidString = String(feature.properties.centroid.coordinates[0]) +
            //                      ',' +
            //                      String(feature.properties.centroid.coordinates[1]);
            // if (addressesOnTheMap[centroidString]) {
            //   return false;
            //   addressesOnTheMap[centroidString] += 1;
            //   if(addressesOnTheMap[centroidString] === 3) {
            //     return false;
            //   }
            // }
            // addressesOnTheMap[centroidString] = 1;

            return true;
          });

          // Create a new GeoJSON layer and style it.
          var geoJSONLayer = new L.geoJson(featureCollection, {
            style: featureStyle,
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
          // if (loadingCount === 0) {
          //   // Hide the spinner
          //   // TODO
          //   // $.mobile.hidePageLoadingMsg();
          // }
        });
      });

      // Clean up parcels while we wait for the remote data.
      cleanupParcels(bounds);
    }

    // Adds a checkbox marker to the given point
    function addDoneMarker(latlng, id) {
      // Only add markers if they aren't already on the map.
      if (markers[id] === undefined  || id === ''){
        var doneIcon = new settings.icons.CheckIcon();
        var doneMarker = new L.Marker(latlng, {icon: doneIcon});
        doneMarkersLayer.addLayer(doneMarker);
        markers[id] = doneMarker;
      }
    }

    // Flag existing responses so we can style them appropriately on the map.
    // Note that this doesn't create a new layer for existing responses
    // It just marks the base data we've got
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

      // If we need to mark responses as stale, let's precompute the
      // best-before date here.
      var staleBefore;
      if (settings.survey.responseLongevity) {
        staleBefore = Date.now() - settings.survey.responseLongevity;
      }

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

          // If we're processing a completed response, mark it correctly:
          if (type === 'completed') {

            // We flag stale responses on some surveys
            if (settings.survey.responseLongevity) {
              var created = new Date(response.created);

              if (created > staleBefore) {
                freshParcelIds[parcelId] = true;
              }
            }

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
          layer.setStyle(featureStyle);
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
