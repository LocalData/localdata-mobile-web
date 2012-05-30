var NSB.API = new function {
  /*
   * Generates the URL to retrieve results for a given parcel
   */
  this.getSurveyURL = function() {
    return settings.api.baseurl + "/surveys/" + settings.surveyid;
  }
  
  this.getParcelDataURL = function(parcel_id) {
    return settings.api.baseurl + '/surveys/' + settings.surveyid + '/parcels/' + parcel_id + '/responses';
  }

  /*
   * Given a Leaflet latlng object, return a JSON object that describes the 
   * parcel.
   * Attributes: parcel_id (string), address (string), polygon (GeoJSON)
   * TODO: RENAME
   */
  this.getObjectDataAtPoint = function (latlng, callback) {
    var lat = latlng.lat;
    var lng = latlng.lng; //http://stormy-mountain-3909.herokuapp.com
    
    
    var url = 'http://stormy-mountain-3909.herokuapp.com/detroit/parcel?lat=' + lat + '&lng=' + lng;
    console.log(url);
    
    $.getJSON(url, function(data){
      // Process the results. Strip whitespace. Convert the polygon to geoJSON
      // TODO: This will need to be genercized (id column, addres, etc.)
      var result = {
        parcel_id: data[0].trim(), 
        address: data[3].trim(),
        polygon: jQuery.parseJSON(data[4]),
        centroid: jQuery.parseJSON(data[5])
      };
      callback(result);
    });
  }
  
}