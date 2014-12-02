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
    bufferParcels: 18,
    // Show a streetmap base layer, instead of an aerial-hybrid, past zoom 19.
    aerialCutoff: 19,
    mapMin: 11,
    mapMax: 23
  };

  var mapView = {};

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

  mapView.objectSelected = function objectSelected(selection, scroll) {
    var visibleHeight = 200;

    // TODO: Have the page controller/view-model coordinate movement/display of
    // the map and form.

    var mapDiv = mapView.$el;
    var height = mapDiv.height();
    var offset;

    if (scroll) {
      if (crosshairLayer) {
        // If the map is in point-selection mode, then we want to slide most of
        // the map out of view but keep the point marker visible.

        var middle = mapDiv.position().top + (height / 2);
        offset = middle - crosshairLayer.options.icon.options.iconAnchor.y;
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
        var center = map.project(L.latLng(selection.centroid.coordinates[1], selection.centroid.coordinates[0]));
        center.y -= (height/2 - visibleHeight/2);
        map.panTo(map.unproject(center), {
          animate: true,
        });
      }
    }
  };

  // Add a point to the map
  // Essentially a counterpart to featureSelectionHandler
  function addPoint(scroll) {
    var lnglat = [map.getCenter().lng, map.getCenter().lat];

    $.publish('map:pointSelected', [lnglat, scroll]);
  }

  function crosshairMove() {
    crosshairLayer.setLatLng(map.getCenter());
  }

  function crosshairMoveEnd() {
    crosshairLayer.setLatLng(map.getCenter());
    addPoint(false);
  }

  function crosshairMapClick(event) {
    map.panTo(event.latlng);
    crosshairLayer.setLatLng(event.latlng);
    addPoint(true);
  }

  // Show the add / remove point interface
  mapView.showPointInterface = function showPointInterface() {
    crosshairLayer = L.marker([0,0], {
      icon: settings.icons.CrosshairIcon
    });
    map.addLayer(crosshairLayer);

    // Move the crosshairs as the map moves
    map.on('move', crosshairMove);
    map.on('dragend', crosshairMoveEnd);
    map.on('click', crosshairMapClick);
  };

  mapView.hidePointInterface = function hidePointInterface (argument) {
    map.removeLayer(crosshairLayer);
    map.off('move', crosshairMove);
    map.off('dragend', crosshairMoveEnd);
    map.off('click', crosshairMapClick);
    crosshairLayer = null;
  };

  mapView.setupAddressPointSurvey = function setupAddressPointSurvey() {
    crosshairLayer = L.marker([0,0], {icon: settings.icons.CrosshairIcon});
    map.addLayer(crosshairLayer);

    // Move the crosshairs as the map moves
    map.on('move', function(e){
      crosshairLayer.setLatLng(map.getCenter());
    });

    $('#geolocate').hide();
    $('#entry').show();
  };

  mapView.restyle = function restyle() {
    parcelsLayerGroup.eachLayer(function (layer) {
      layer.setStyle(featureStyle);
    });
  };

  mapView.init = function(mapContainerId) {
    console.log('Initializing map');

    mapView.$el = $('#' + mapContainerId);

    map = L.map(mapContainerId, {
      minZoom: zoomLevels.mapMin,
      maxZoom: zoomLevels.mapMax
    });

    map.addLayer(parcelsLayerGroup);
    map.addLayer(doneMarkersLayer);

    // Hack to show the map with JQuery mobile
    setTimeout(function(){
      map.invalidateSize();
    }, 0);

    // Add bing maps
    var bing = new L.BingLayer(settings.bing_key, {
      maxZoom: zoomLevels.aerialCutoff,
      type:'AerialWithLabels'
    });

    var streets = new L.TileLayer('http://a.tiles.mapbox.com/v3/matth.map-n9bps30s/{z}/{x}/{y}.png', {
      minZoom: zoomLevels.aerialCutoff + 1,
      maxZoom: zoomLevels.mapMax
    });
    map.addLayer(streets);
    map.addLayer(bing);

    // When we zoom out from the min streetmap level to the max aerial level,
    // Leaflet keeps a scaled set of the old streetmap tiles visible. We set
    // the opacity to 0 to hide them.
    map.on('zoomend', function () {
      if (map.getZoom() > zoomLevels.aerialCutoff) {
        streets.setOpacity(1);
      } else {
        streets.setOpacity(0);
      }
    });

    // Check for new responses when we submit
    $.subscribe('successfulSubmit', getResponsesInMap);

    // Set up zones, if any
    if (_.has(settings.survey, 'zones')) {
      var zoneLayer = new L.geoJson(settings.survey.zones, {
        style: zoneStyle
      });
      map.addLayer(zoneLayer);
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
      }
      map.setView(e.latlng, 19);

      getResponsesInMap();
      renderParcelsInBounds();
    }

    // Move the map ............................................................
    // Center the map on location.
    mapView.goToLocation = function goToLocation(coords, options) {
      if (circle !== null) {
        map.removeLayer(circle);
      }

      // Add the accuracy circle to the map
      var radius = 4;
      var latlng = new L.LatLng(coords[1], coords[0]);
      circle = new L.Circle(latlng, radius, {
        clickable: false
      });
      map.addLayer(circle);
      map.setView(latlng, options.zoom || 19);
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
  }; // end init


  // Map information used by other parts of the app ..........................

  // Return the bounds of the map as a string
  mapView.getMapBounds = function() {
    var bounds = '';
    bounds += map.getBounds().getNorthWest().toString();
    bounds += ' ' + map.getBounds().getSouthEast().toString();
    return bounds;
  };


  function featureSelectionHandler(e) {
    $.publish('map:objectSelected', [e]);
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
          },
          onEachFeature: function (feature, layer) {
            layer.on('click', featureSelectionHandler);
          }
        });

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

  return mapView;
});
