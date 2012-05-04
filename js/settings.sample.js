var settings = {
  bing_key: "",
  
};

var BASEURL = ''; // no trailing slash
var GEOAPI = '';
var SURVEYID = '';

var maps = {
  'san francisco': {
    'json': 'http://a.tiles.mapbox.com/v3/matthdev.soma.jsonp',
    'interaction': 'setFormParcelSF' // Name of the function that gets parcel info
  },
  'detroit': {
    'json': 'http://a.tiles.mapbox.com/v3/matthdet.detroit.jsonp',
    'interaction': 'setFormParcelDET'
  }
};
var locale = "san francisco"; // our current set of parcels. 
locale = "detroit";

// Legacy:
var CARTO_ACCOUNT = '';

