NSB.settings = {
  // ID of the current survey
  surveyid: 'test-survey-id',
  
  // URLs of services used to store, retrieve survey data
  api: {
    baseurl: 'http://example.com', // no trailing slash
    geo: 'http://example.com/geoapi',
  },
  
  // Information about where to find map tiles.
  // Used for rendering maps
  locale: 'flatland', // our current set of parcels. 
  maps: {
    'flatland': {
      'json': 'http://a.tiles.mapbox.com/v3/flatland.jsonp'
    },
    'earth': {
      'json': 'http://a.tiles.mapbox.com/v3/earth.jsonp'
    },
  },
  
  // Keys for external services
  // In the future, we should move these out to a separate, untracked file
  // Right now, the danger is low. 
  bing_key: 'bing-key'
};

