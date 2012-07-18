NSB.API = new function() {
  /*
   * Generates the URL to retrieve results for a given parcel
   */
  this.getSurveyURL = function() {
    return NSB.settings.api.baseurl + "/surveys/" + NSB.settings.surveyid;
  };
  
  this.getParcelDataURL = function(parcel_id) {
    return NSB.settings.api.baseurl + '/surveys/' + NSB.settings.surveyid + '/parcels/' + parcel_id + '/responses';
  };
  
  this.getGeoPointInfoURL = function(lat, lng) {
    return NSB.settings.api.geo + '/detroit/parcel?lat=' + lat + '&lng=' + lng;
  };
  
  // Given a Leaflet latlng object, return a JSON object that describes the 
  // parcel.
  this.getObjectDataAtPoint = function(latlng, callback) {
    console.log("Processing PostGIS data");
    var lat = latlng.lat;
    var lng = latlng.lng; 
    
    var url = this.getGeoPointInfoURL(lat, lng);
    
    $.getJSON(url, function(data){
      // Process the results. Strip whitespace. Convert the polygon to geoJSON
      // TODO: This will need to be genercized (id column, addres, etc.)
      callback(NSB.API.parseObjectData(data));
    }, this);
  };
  
  // Deal with the formatting of the geodata API.
  // In the future, this will be more genericized. 
  // parcel_id => object_id
  // address => object_location
  this.parseObjectData = function(data) {
    return {
      parcel_id: data[0].trim(), 
      address: data[3].trim(),
      polygon: jQuery.parseJSON(data[4]),
      centroid: jQuery.parseJSON(data[5])
    };
  };
  
  // Take an address string. 
  // Add "Detroit" to the end.
  // Return the first result as a lat-lng for convenience.
  // Or Null if Bing is being a jerk / we're dumb. 
  this.codeAddress = function(address, callback) {
    console.log("Coding an address");
    console.log(address);
    var detroitAddress = address + " Detroit, MI"; // for ease of geocoding
    var geocodeEndpoint = "http://dev.virtualearth.net/REST/v1/Locations/" + detroitAddress + "?o=json&key=" + NSB.settings.bing_key + "&jsonp=?";

    $.getJSON(geocodeEndpoint, function(data){
      if(data.resourceSets.length > 0){
        var point = data.resourceSets[0].resources[0].point;
        var latlng = new L.LatLng(point.coordinates[0], point.coordinates[1]);
        callback(latlng);
      };
    });    
  };
  
  // Take a map bounds object
  // Find the objects in the bounds
  // Feed those objects to the callback
  this.getObjectsInBounds = function(bounds, callback) {
    southwest = bounds.getSouthWest();
    northeast = bounds.getNorthEast();
    
    // Given the bounds, generate a URL to ge the responses from the API.
    serializedBounds = southwest.lat + "," + southwest.lng + "," + northeast.lat + "," + northeast.lng;
    var url = NSB.API.getSurveyURL() + "/responses/in/" + serializedBounds;
    //  console.log(url);

    // Give the callback the responses.
    $.getJSON(url, function(data){
      if(data.responses) {
        callback(data.responses);
      };
    });
  };
  
  
  
};