NSB.MapView = new function(){
  var map, marker, circle;
  var markers = {};
  var doneMarkersLayer = new L.LayerGroup();
  var pointMarkersLayer = new L.LayerGroup();

  var selected_polygon = false;
  var selected_centroid = false;
  var selected_parcel_json = false;


  // Private things ==========================================================
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
  
  /* 
   * Attempt to center the map on an address using Google's geocoder.
   */
  function codeAddress(address) {
    //var address = document.getElementById("address-search").value;
    console.log(address);
    var detroit_address = address + " Detroit, MI"; // for ease of geocoding
    var url = "http://dev.virtualearth.net/REST/v1/Locations/" + detroit_address + "?o=json&key=" + NSB.settings.bing_key + "&jsonp=?";

    console.log(url);
    $.getJSON(url, function(data){
      if(data.resourceSets.length > 0){
        console.log(data);
        var point = data.resourceSets[0].resources[0].point;
        console.log(point);
        var latlng = new L.LatLng(point.coordinates[0], point.coordinates[1]);

        var marker = new L.Marker(latlng);
        map.addLayer(marker);
        map.setView(latlng, 18);
      };    
    });
  };
  
  
  /* 
   * Given a map object, return the bounds as a string
   */
  function getMapBounds(m) {
    bounds = "";
    bounds += m.getBounds().getNorthWest().toString();
    bounds += " " + m.getBounds().getSouthEast().toString();  
    return bounds;
  };

  
  this.init = function() {
    /*
      Draw the parcel map on the survey page
    */
    map = new L.Map('map-div', {minZoom:13, maxZoom:18});

    // Add the layer of done markers
    map.addLayer(doneMarkersLayer);

    // Add a bing layer to the map
    bing = new L.BingLayer(NSB.settings.bing_key, 'AerialWithLabels', {maxZoom:21});
    map.addLayer(bing);

    // Add the TileMill maps. 
    // Get the JSON url from the settings.
    wax.tilejson(NSB.settings.maps[NSB.settings.locale]['json'], function(tilejson) {
      map.addLayer(new wax.leaf.connector(tilejson));

      // Highlight parcels when clicked
      map.on('click', function(e) {
        // e contains information about the interaction. 
       // console.log(e);
       getPostgresData(e.latlng, function(data){
         selected_parcel_json = data;
         selected_centroid = new L.LatLng(selected_parcel_json.centroid.coordinates[1], selected_parcel_json.centroid.coordinates[0]);
         setFormParcelPostGIS(data);
         highlightPolygon(map, data);
         selectParcel();
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
      //map.locate({setView: true, maxZoom: 18});
      // var sf = new L.LatLng(37.77555050754543, -122.41365958293713);
      // For Detroit testing: 
      var detroit = new L.LatLng(42.305213, -83.126260);
      map.setView(detroit, 18);


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
  
  
  /* 
   * Outline the given polygon
   */
  function highlightPolygon(map, selected_parcel_json) {
    // expects format: 
    // {coordinates: [[x,y], [x,y], ...] }

    polygon_json = selected_parcel_json.polygon;

    // Remove existing highlighting 
    if(selected_polygon) {
      map.removeLayer(selected_polygon);
    };

    console.log("Polygon JSON");
    console.log(polygon_json);

    // Add the new polygon
    var polypoints = new Array();  
    for (var i = polygon_json.coordinates[0].length - 1; i >= 0; i--){
      point = new L.LatLng(polygon_json.coordinates[0][i][1], polygon_json.coordinates[0][i][0]);
      polypoints.push(point);
    };
    options = {
        color: 'red',
        fillColor: 'transparent',
        fillOpacity: 0.5
    };
    selected_polygon = new L.Polygon(polypoints, options);
    map.addLayer(selected_polygon);

    return selected_polygon;  
  }
  
  /*
   * Adds a checkbox marker to the given point
   */
  function addDoneMarker(latlng, id) {

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
   * TODO -- Extract out API stuff
   */
  function getResponsesInMap(){  
    // Don't add any markers if the zoom is really wide out. 
    zoom = map.getZoom();
    if(zoom < 17) {
      return;
    }

    // Get the map bounds
    bounds = map.getBounds();
    southwest = bounds.getSouthWest();
    northeast = bounds.getNorthEast();

    // Given the bounds, generate a URL to ge the responses from the API.
    serialized_bounds = southwest.lat + "," + southwest.lng + "," + northeast.lat + "," + northeast.lng;
    var url = this.getSurveyURL() + "/responses/in/" + serialized_bounds;
    console.log(url);

    // Loop through the responses and add a done marker.
    $.getJSON(url, function(data){
      if(data.responses) {
        $.each(data.responses, function(key, elt) {
          p = new L.LatLng(elt.geo_info.centroid[0],elt.geo_info.centroid[1]);
          id = elt.parcel_id;
          addDoneMarker(p, id);
          console.log(p);
        });
      };
    });
  };
  
  
  
  /*
   * Hides and shows things once the parcel has been suggested.
   */
  function selectParcel(m, latlng) {
    if(!$('#form').is(":visible")) {
        $('#form').slideToggle();
    }
    if($('#startpoint').is(":visible")) {
      $('#startpoint').slideToggle();
    }
    if($('#thanks').is(":visible")) {
      $('#thanks').slideToggle();
    }
  };
                       
  // Private
  var privatestuff = function() {
    
  };
  
  // Public
  this.something = function(){
    privatestuff();
  };
  
  // Getters / Setters

  
};