/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/underscore');
  var settings = require('settings');
  var api = require('api');
  var L = require('lib/leaflet');

  return function (app, mapContainerId) {

    var map, marker, circle;
    var markers = {};
    var numObjectsOnMap = 0;
    var parcelIdsOnTheMap = {};
    var parcelsLayerGroup = new L.LayerGroup();
    var doneMarkersLayer = new L.LayerGroup();
    var pointMarkersLayer = new L.LayerGroup();

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
      'weight': 3,
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

    this.init = function() {
      console.log('Initialize map');
      console.log(settings.survey);
      map = new L.Map(mapContainerId, {minZoom:13, maxZoom:21});

      map.addLayer(parcelsLayerGroup);
      map.addLayer(doneMarkersLayer);

      // Add bing maps
      var bing = new L.BingLayer(settings.bing_key, {maxZoom:21, type:'AerialWithLabels'});
      map.addLayer(bing);


      // If this is a point-based survey, add a crosshair over null island
      if(settings.survey.type === 'point') {
        crosshairLayer = L.marker([0,0], {icon: CrosshairIcon});
        map.addLayer(crosshairLayer);

        // Move the crosshairs as the map moves
        map.on('move', function(e){
          crosshairLayer.setLatLng(map.getCenter());
        });

        $('#addPoint').show();
      }

      $.subscribe('successfulSubmit', getResponsesInMap);

      // Show which parcels have responses when the map is moved.
      map.on('moveend', function(event) {
        try {
          getResponsesInMap();
          renderParcelsInBounds();
        } catch(exception){
          // TODO
        }
      });


      // Location handlers
      // Used for centering the map when we're using geolocation.
      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);

      map.locate({setView: true, maxZoom: 19});

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
        // TODO: handle this better
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
        map.locate({setView: true, maxZoom: 19});
      });

      // Add a point to the map and open up the survey
      $('#addPoint').click(function() {
        // Deselect the previous layer, if any
        if (newPoint !== null) {
          map.removeLayer(newPoint);
        }

        // Add the point at the center of the map
        // Two formats :-\
        var lnglat = [map.getCenter().lng, map.getCenter().lat];
        var latlng  = new L.LatLng(map.getCenter().lat, map.getCenter().lng);

        // Keep track of the selected object centrally
        app.selectedObject.id = '';
        app.selectedObject.humanReadableName = 'Custom location';
        app.selectedObject.centroid = { coordinates: lnglat };
        console.log(app.selectedObject);

        // Create a marker on the map
        newPoint = L.marker(latlng, {icon: PlaceIcon});
        map.addLayer(newPoint);

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

    // Render parcels that are currently visible in the map
    // Gets geodata from our api
    var renderParcelsInBounds = function() {
      console.log('Map: getting & rendering parcels in bounds');

      // Don't load and render a basemap if the survey is point-based
      if (settings.survey.type === 'point') {
        return;
      }
 
      // Don't add any parcels if the zoom is really far out. 
      var zoom = map.getZoom();
      if(zoom < 17) {
        return;
      }

      // If we have too many objects, let's delete them
      // This keep the app responsive
      console.log(numObjectsOnMap);
      if(numObjectsOnMap > 175) {
        parcelsLayerGroup.clearLayers();
        // TODO - does setting this to an empty object 
        // result in good garbage collection? Or do we have references to 
        // layers still floating around?
        parcelIdsOnTheMap = {};
        numObjectsOnMap = 0;
      }

      if(_.isEmpty(parcelIdsOnTheMap)) {
        $.mobile.showPageLoadingMsg();
      }

      // Decide which function we use to get the base layer
      var options = {};
      var getParcelFunction = api.getObjectsInBounds;
      if(_.has(settings.survey, 'geoObjectSource')) {
        if (settings.survey.geoObjectSource.type === 'ArcGIS Server') {
          getParcelFunction = api.getObjectsInBoundsFromESRI;
          options = settings.survey.geoObjectSource;
        }
      }

      // Get data for the base layer given the current bounds
      // And then render it in the bounds of the map
      getParcelFunction(map.getBounds(), options, function(results) {
        console.log('Received parcel data');

        _.each(results, function(elt) {    

          // We don't want to re-draw parcels that are already on the map
          // So we keep a hash map with the layers so we can unrender them
          if (parcelIdsOnTheMap[elt.parcelId] !== undefined){
            return;
          }

          // Make sure the format fits Leaflet's geoJSON expectations
          if(!elt.geometry){
            elt.geometry = elt.polygon;
          }
          
          elt.type = 'Feature';

          // Create a new geojson layer and style it. 
          var geojsonLayer = new L.GeoJSON();
          geojsonLayer.addData(elt);
          geojsonLayer.setStyle(defaultStyle);

          // Handle clicks on the layer
          geojsonLayer.on('click', function(e){ 

            // Deselect the previous layer, if any
            if (selectedLayer !== null) {
              selectedLayer.setStyle(defaultStyle);
            }

            // Keep track of the selected object centrally
            app.selectedObject.id = elt.parcelId;
            app.selectedObject.humanReadableName = elt.address;
            app.selectedObject.centroid = elt.centroid;
            app.selectedObject.geometry = elt.geometry; 

            // Select the current layer
            selectedLayer = e.layer;
            selectedLayer.setStyle(selectedStyle);

            // Let other parts of the app know that we've selected something.
            $.publish('objectSelected');
          });

          // Add the layer to the layergroup and the hashmap
          parcelsLayerGroup.addLayer(geojsonLayer);
          parcelIdsOnTheMap[elt.parcelId] = geojsonLayer;
          numObjectsOnMap += 1;

        }); // done getting parcels
        // Hide the spinner
        $.mobile.hidePageLoadingMsg();

      });
    };

    // Outline the given polygon
    //
    // @param {Object} selectedObjectJSON A reference to the object to be hihlighted
    // expects polygon to be {coordinates: [[x,y], [x,y], ...] }
    var highlightObject = function(selectedObjectJSON) {
      var i;
      var options;
      var point;
      var polypoints = [];  

      polygonJSON = selectedObjectJSON.polygon;

      // Remove existing highlighting 
      if(selectedPolygon) {
        map.removeLayer(selectedPolygon);
      }

      // Add the new polygon
      for (i = polygonJSON.coordinates[0].length - 1; i >= 0; i--){
        point = new L.LatLng(polygonJSON.coordinates[0][i][1], polygonJSON.coordinates[0][i][0]);
        polypoints.push(point);
      }

      options = {
        color: 'red',
        fillColor: 'transparent',
        fillOpacity: 0.5
      };
      selectedPolygon = new L.Polygon(polypoints, options);
      map.addLayer(selectedPolygon);
    };

    // Adds a checkbox marker to the given point
    var addDoneMarker = function(latlng, id) {

      console.log('Adding done marker');
      // Only add markers if they aren't already on the map.
      if (markers[id] == undefined  || id === ''){
        var doneIcon = new CheckIcon();
        var doneMarker = new L.Marker(latlng, {icon: doneIcon});
        doneMarkersLayer.addLayer(doneMarker);
        markers[id] = doneMarker;
      }
    };

    // Get all the responses in a map 
    var getResponsesInMap = function(){  
      console.log('Getting responses in the map');

      // Don't add any markers if the zoom is really far out. 
      var zoom = map.getZoom();
      if(zoom < 17) {
        return;
      }

      // Get the objects in the bounds
      // And add them to the map   
      api.getResponsesInBounds(map.getBounds(), function(results) {
        console.log(results);
        $.each(results, function(key, elt) {
          var p = new L.LatLng(elt.geo_info.centroid[0], elt.geo_info.centroid[1]);
          var id = elt.parcel_id;
          addDoneMarker(p, id);
        });
      });

    };

    // Map init ================================================================
    this.init();
  };
});
