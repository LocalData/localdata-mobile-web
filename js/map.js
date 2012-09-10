NSB.MapView = function(mapContainerId){
    
  var map, marker, circle;
  var markers = {};
  var parcelIdsOnTheMap = {};
  var parcelsLayerGroup = new L.LayerGroup();
  var doneMarkersLayer = new L.LayerGroup();
  var pointMarkersLayer = new L.LayerGroup();

  var selectedLayer = null;
  var selectedPolygon = null;
  var selectedCentroid = null;
  var selectedObjectJSON = null;
  

  /* Styles for parcel outlines */
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
    console.log("Initialize map");
    map = new L.Map(mapContainerId, {minZoom:13, maxZoom:21});
    
    map.addLayer(parcelsLayerGroup);
    map.addLayer(doneMarkersLayer);
    
    var bing = new L.BingLayer(NSB.settings.bing_key, {maxZoom:21, type:"AerialWithLabels"});
    map.addLayer(bing);
    
    $.subscribe("successfulSubmit", getResponsesInMap);    
    
    // Show which parcels have responses when the map is moved.
    map.on('moveend', function(e) {
      try {
        getResponsesInMap();
        renderParcelsInBounds();
      } catch(e){}
    });

    // Location handlers
    // Used for centering the map when we're using geolocation.
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    map.locate({setView: true, maxZoom: 19});

    // Mark a location on the map. 
    // Primarily used with browser-based geolocation (aka "where am I?")
    function onLocationFound(e) {
      // Remove the old circle if we have one
      if (circle !== undefined) {
        map.removeLayer(circle);
      };

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
  

    // Map tools .............................................................
    
    // Handle searching for addresses
    $("#address-search-toggle").click(function(){
      $("#address-search").slideToggle();
      $("#address-search-prompt").slideToggle();
    });
    
    $("#address-submit").click(function(){
      goToAddress($("#address-input").val());
    });
    
    $("#geolocate").click(function(){
       map.locate({setView: true, maxZoom: 19});
    });
        
  }; // end init
  
  
  // Map information used by other parts of the app ..........................
  
  this.getSelectedCentroid = function() {
    return NSB.selectedObject.centroid;
  };
  
  // Return the bounds of the map as a string
  this.getMapBounds = function() {
    bounds = "";
    bounds += map.getBounds().getNorthWest().toString();
    bounds += " " + map.getBounds().getSouthEast().toString();  
    return bounds;
  };
  

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
  
  
  // Move the map ............................................................
  // Attempt to center the map on an address using Google's geocoder.
  // This should probably live in APIs. 
  var goToAddress = function(address) {
    NSB.API.codeAddress(address, function(latlng){
      if (circle !== undefined) {
        map.removeLayer(circle);
      };

      // Add the accuracy circle to the map
      var radius = 4;
      circle = new L.Circle(latlng, radius);
      map.addLayer(circle);
      map.setView(latlng, 19);

      // Scroll to the top so users can 
      window.scrollTo(0,0);
      $("#address-search").slideToggle();
      $("#address-search-prompt").slideToggle();


    });
  };
    
    
  // Handle selecting objects ................................................
  
  // Render parcels that are currently visible in the map
  // Gets geodata from our api
  var renderParcelsInBounds = function() {
    console.log("Rendering parcels in bounds");
    
    // Don't add any parcels if the zoom is really far out. 
    zoom = map.getZoom();
    if(zoom < 17) {
      return;
    }
    
    // TODO: If we have too many objects, let's delete them
    console.log(parcelsLayerGroup);
    if(_.isEmpty(parcelIdsOnTheMap)) {
      $.mobile.showPageLoadingMsg();
    };
    
    // Get parcel data in the bounds
    NSB.API.getObjectsInBounds(map.getBounds(), function(results) {
      console.log("Received parcel data");
      
      $.each(results, function(key, elt) {    
        
        // We don't want to re-draw parcels that are already on the map
        // So we keep a hash map with the layers so we can unrender them
        if (parcelIdsOnTheMap[elt.parcelId] === undefined){
         
          // Make sure the format fits Leaflet's geoJSON expectations
          elt.geometry = elt.polygon;
          elt.type = "Feature";

          // Create a new geojson layer and style it. 
          var geojsonLayer = new L.GeoJSON();
          geojsonLayer.addData(elt);
          geojsonLayer.setStyle(defaultStyle);
          
          geojsonLayer.on('click', function(e){ 
          
            // Deselect the previous layer, if any
            if (selectedLayer !== null) {
              selectedLayer.setStyle(defaultStyle);
            }
            
            // Keep track of the selected object centrally
            NSB.selectedObject.id = elt.parcelId;
            NSB.selectedObject.humanReadableName = elt['address'];
            NSB.selectedObject.centroid = elt['centroid'];
            NSB.selectedObject.geometry = elt.geometry; 
            console.log(NSB.selectedObject);
            
            // Select the current layer
            selectedLayer = e.layer;
            selectedLayer.setStyle(selectedStyle);
            
            // Let other parts of the app know that we've selected something.
            $.publish("objectSelected");
            
          });
          
          // Add the layer to the layergroup and the hashmap
          parcelsLayerGroup.addLayer(geojsonLayer);
          parcelIdsOnTheMap[elt.parcelId] = geojsonLayer;
        };
      }); // done getting parcels
      // Hide the spinner
      $.mobile.hidePageLoadingMsg();
      
    });
  };
  
  // Outline the given polygon
  // expects polygon to be {coordinates: [[x,y], [x,y], ...] }
  var highlightObject = function(selectedObjectJSON) {
    polygonJSON = selectedObjectJSON.polygon;

    // Remove existing highlighting 
    if(selectedPolygon) {
      map.removeLayer(selectedPolygon);
    };

    // Add the new polygon
    var polypoints = new Array();  
    for (var i = polygonJSON.coordinates[0].length - 1; i >= 0; i--){
      point = new L.LatLng(polygonJSON.coordinates[0][i][1], polygonJSON.coordinates[0][i][0]);
      polypoints.push(point);
    };
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
    // Only add markers if they aren't already on the map.
    if (markers[id] == undefined){
      var doneIcon = new CheckIcon();
      doneMarker = new L.Marker(latlng, {icon: doneIcon});
      doneMarkersLayer.addLayer(doneMarker);
      markers[id] = doneMarker;
    };
  };
  
  // Get all the responses in a map 
  var getResponsesInMap = function(){  
    console.log("Getting responses in the map");
    
    // Don't add any markers if the zoom is really far out. 
    zoom = map.getZoom();
    if(zoom < 17) {
      return;
    }

    // Get the objects in the bounds
    // And add them to the map   
    NSB.API.getResponsesInBounds(map.getBounds(), function(results) {
      console.log(results);
      $.each(results, function(key, elt) {
        p = new L.LatLng(elt.geo_info.centroid[0], elt.geo_info.centroid[1]);
        id = elt.parcel_id;
        addDoneMarker(p, id);
      });
    });

  };
  
  // Map init ================================================================
  this.init();
};