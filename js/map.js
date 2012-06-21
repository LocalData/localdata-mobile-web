NSB.MapView = function(mapContainerId){
    
  var map, marker, circle;
  var markers = {};
  var doneMarkersLayer = new L.LayerGroup();
  var pointMarkersLayer = new L.LayerGroup();

  var selectedPolygon = false;
  var selectedCentroid = false;
  var selectedObjectJSON = false;
  
  this.init = function() {
    map = new L.Map(mapContainerId, {minZoom:13, maxZoom:18});

    // Add the layer of done markers; will be populated later
    map.addLayer(doneMarkersLayer);

    // Add a bing layer to the map
    bing = new L.BingLayer(NSB.settings.bing_key, 'AerialWithLabels', {maxZoom:21});
    map.addLayer(bing);

    // Add the maps from TileMill. 
    wax.tilejson(NSB.settings.maps[NSB.settings.locale]['json'], function(tilejson) {
      map.addLayer(new wax.leaf.connector(tilejson));

      // Highlight parcels when clicked
      map.on('click', function(e) {
        getPostgresData(e.latlng, function(data){
          selectedObjectJSON = data;
          selectedObjectJSON.selectedCentroid = new L.LatLng(selectedObjectJSON.centroid.coordinates[1], selectedObjectJSON.centroid.coordinates[0]);      
          
          highlightObject(data);
          $.publish("objectSelected", [data.parcel_id, data.address]);
        });
        
        
      });

      map.on('moveend', function(e) {
        try {
          getResponsesInMap();
        } catch(e){}
      });

      // Used for centering the map when we're using geolocation.
      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);

      // Center the map 
      map.locate({setView: true, maxZoom: 18});

      // Mark a location on the map. 
      // Primarily used with browser-based geolocation (aka "where am I?")
      function onLocationFound(e) {
        // Add the accuracy circle to the map
      	var radius = e.accuracy / 2;
      	circle = new L.Circle(e.latlng, radius);
      	map.addLayer(circle);

      	getResponsesInMap();
      }

      function onLocationError(e) {
      	alert(e.message);
      }
    });
  };
  
  
  // Icons ===================================================================
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
  
  
  // APIs ====================================================================
  /* 
   * Attempt to center the map on an address using Google's geocoder.
   */
  var codeAddress = function(address) {
    //var address = document.getElementById("address-search").value;
    console.log(address);
    var detroitAddress = address + " Detroit, MI"; // for ease of geocoding
    var geocodeEndpoint = "http://dev.virtualearth.net/REST/v1/Locations/" + detroitAddress + "?o=json&key=" + NSB.settings.bing_key + "&jsonp=?";

    $.getJSON(url, function(data){
      if(data.resourceSets.length > 0){
        var point = data.resourceSets[0].resources[0].point;
        var latlng = new L.LatLng(point.coordinates[0], point.coordinates[1]);

        var marker = new L.Marker(latlng);
        map.addLayer(marker);
        map.setView(latlng, 18);
      };    
    });
  };
  
  
  // Given a Leaflet latlng object, return a JSON object that describes the 
  // parcel.
  // Attributes: parcel_id (string), address (string), polygon (GeoJSON)
  var getPostgresData = function(latlng, callback) {
    var lat = latlng.lat;
    var lng = latlng.lng; //http://stormy-mountain-3909.herokuapp.com
    var url = 'http://stormy-mountain-3909.herokuapp.com/detroit/parcel?lat=' + lat + '&lng=' + lng;
    console.log(url);
    
    $.mobile.showPageLoadingMsg(); //Show spinner
    
    $.getJSON(url, function(data){
      // Process the results. Strip whitespace. Convert the polygon to geoJSON
      var result = {
        parcel_id: data[0].trim(), 
        address: data[3].trim(),
        polygon: jQuery.parseJSON(data[4]),
        centroid: jQuery.parseJSON(data[5])
      };
      
      $.mobile.hidePageLoadingMsg(); //Hide spinner
      callback(result);
    });
  };
  

  /* 
   * Return the bounds of the map as a string
   */
  var getMapBounds = function() {
    bounds = "";
    bounds += map.getBounds().getNorthWest().toString();
    bounds += " " + map.getBounds().getSouthEast().toString();  
    return bounds;
  };
  
  
  // Handle selecting objects ===============================================
  /* 
   * Outline the given polygon
   * expects polygon to be {coordinates: [[x,y], [x,y], ...] }
   */
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
  
  /*
   * Adds a checkbox marker to the given point
   */
  var addDoneMarker = function(latlng, id) {
    // Only add markers if they aren't already on the map.
    if (markers[id] == undefined){
      var doneIcon = new CheckIcon();
      doneMarker = new L.Marker(latlng, {icon: doneIcon});
      doneMarkersLayer.addLayer(doneMarker);
      markers[id] = doneMarker;
    };
  };
  
  
  /*
   * Get all the responses in a map 
   */
  var getResponsesInMap = function(){  
    // Don't add any markers if the zoom is really far out. 
    zoom = map.getZoom();
    if(zoom < 17) {
      return;
    }

    // Get the map bounds
    bounds = map.getBounds();
    southwest = bounds.getSouthWest();
    northeast = bounds.getNorthEast();

    // Given the bounds, generate a URL to ge the responses from the API.
    serializedBounds = southwest.lat + "," + southwest.lng + "," + northeast.lat + "," + northeast.lng;
    var url = NSB.API.getSurveyURL() + "/responses/in/" + serializedBounds;
    console.log(url);

    // Loop through the responses and add a done marker.
    $.getJSON(url, function(data){
      if(data.responses) {
        $.each(data.responses, function(key, elt) {
          p = new L.LatLng(elt.geo_info.centroid[0],elt.geo_info.centroid[1]);
          id = elt.parcel_id;
          addDoneMarker(p, id);
        });
      };
    });
  };
  
                       
  // Private
  var privatestuff = function() {
    
  };
  
  // Public
  this.something = function(){
    privatestuff();
  };
  
  this.init();
};