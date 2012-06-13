var settings = {
  bing_key: "Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce",
  
};

var BASEURL = 'http://surveydet.herokuapp.com'; // no trailing slash
// BASEURL = 'http://localhost:3000';
BASEURL = 'http://surveyapidev.herokuapp.com/';

var GEOAPI = 'http://stormy-mountain-3909.herokuapp.com';
var SURVEYID = '23206450-a0ac-11e1-ae6a-a17fba15c6fd'; // WSU
SURVEYID = '69bef580-88eb-11e1-af82-a7908e0eb230'; //test survey

var locale = "detroit-transparent"; // our current set of parcels. 

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
