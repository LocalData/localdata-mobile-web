var settings = {
  bing_key: "Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce",
  
};

var BASEURL = 'http://surveydet.herokuapp.com'; // no trailing slash
BASEURL = 'http://localhost:3000';
var GEOAPI = 'http://stormy-mountain-3909.herokuapp.com';
var SURVEYID = '23206450-a0ac-11e1-ae6a-a17fba15c6fd'; // WSU
SURVEYID = '3dbbc420-9ad6-11e1-b4b6-f184112d9089'; //test survey
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
