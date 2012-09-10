NSB.settings = {
  // ID of the current survey -- set on init.
  surveyid: '', 
  
  // URLs of services used to store, retrieve survey data
  api: {
    baseurl: 'http://surveyapidev.herokuapp.com/api', //'http://localhost:3000', // 'http://surveydet.herokuapp.com', // no trailing slash
    geo: 'http://surveyapidev.herokuapp.com/api'
  },
    
  // Keys for external services
  // In the future, we should move these out to a separate, untracked file
  // Right now, the danger is low. 
  bing_key: 'Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce'
};

