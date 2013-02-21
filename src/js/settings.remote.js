/*globals define: true */

define(function (require) {
  'use strict';
  return {
    // ID of the current survey
    surveyid: 'ece0db00-e0bf-11e1-9ba7-ebbad6f489a5', // 'c6fc1a00-e27f-11e1-9391-a91f94405155', //'', // UNI

    // URLs of services used to store, retrieve survey data
    api: {
      baseurl: '/api', // no trailing slash
      geo: '/api'
    },

    // Keys for external services
    // In the future, we should move these out to a separate, untracked file
    // Right now, the danger is low. 
    bing_key: 'Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce'
  };
});
