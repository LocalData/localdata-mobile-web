function NSBAPI() {
  // Init
  
  // Private
  /*
  Generates the URL to retrieve results for a given parcel
  */
  function getParcelDataURL(parcel_id) {
    return BASEURL + '/surveys/' + SURVEYID + '/parcels/' + parcel_id + '/responses';
  }

  function getSurveyURL() {
    return BASEURL + "/surveys/" + SURVEYID;
  }
  
  function setFormParcelPostGIS(data) {
    console.log(data);
    var parcel_id = data.parcel_id;
    var human_readable_location = data.address;

    $('.parcel_id').val(parcel_id);
    $('h2 .parcel_id').text(human_readable_location);
  };

  
  // Given a Leaflet latlng object, return a JSON object that describes the 
  // parcel.
  // Attributes: parcel_id (string), address (string), polygon (GeoJSON)
  // TODO: RENAME
  function getPostgresData(latlng, callback) {
    var lat = latlng.lat;
    var lng = latlng.lng; //http://stormy-mountain-3909.herokuapp.com
    var url = 'http://stormy-mountain-3909.herokuapp.com/detroit/parcel?lat=' + lat + '&lng=' + lng;
    console.log(url);
    $.getJSON(url, function(data){
      // Process the results. Strip whitespace. Convert the polygon to geoJSON
      var result = {
        parcel_id: data[0].trim(), 
        address: data[3].trim(),
        polygon: jQuery.parseJSON(data[4]),
        centroid: jQuery.parseJSON(data[5])
      };
      callback(result);
    });
  }
  


  
  // Public
  this.something = function(){
    privatestuff();
  };
  
  // Getters / Setters

  
}