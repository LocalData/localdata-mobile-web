var settings = {
  bing_key: "Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce",
  
};

var BASEURL = 'http://surveydet.herokuapp.com'; // no trailing slash
var GEOAPI = 'http://stormy-mountain-3909.herokuapp.com';
var SURVEYID = '1';
var CARTO_ACCOUNT = 'matth';

var locale = "san francisco"; // our current set of parcels. 
locale = "detroit-transparent";
locale = "detroit-transparent";
var maps = {
  'san francisco': {
    'json': 'http://a.tiles.mapbox.com/v3/matthdev.soma.jsonp',
    'interaction': 'setFormParcelSF' // Name of the function that gets parcel info
  },
  'detroit': {
    'json': 'http://a.tiles.mapbox.com/v3/matthdet.detroit.jsonp',
    'interaction': 'setFormParcelDET'
  },
  'detroit-transparent': {
    'json': 'http://a.tiles.mapbox.com/v3/matthdet.detroit-transparent.jsonp',
    'interaction': 'setFormParcelDET'
  }
  
};
