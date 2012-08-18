NSB.settings = {
  // ID of the current survey
  surveyid: 'ece0db00-e0bf-11e1-9ba7-ebbad6f489a5', // 'c6fc1a00-e27f-11e1-9391-a91f94405155', //'', // UNI
  
  // URLs of services used to store, retrieve survey data
  api: {
    baseurl: 'http://localhost:3000/api', //'http://localhost:3000', // 'http://surveydet.herokuapp.com', // no trailing slash
    geo: 'http://parcelserver.herokuapp.com'
  },
  
  // Information about where to find map tiles.
  // Used for rendering maps
  locale: 'detroit-transparent', // our current set of parcels. 
  maps: {
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
  },
  
  // Keys for external services
  // In the future, we should move these out to a separate, untracked file
  // Right now, the danger is low. 
  bing_key: 'Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce'
};

