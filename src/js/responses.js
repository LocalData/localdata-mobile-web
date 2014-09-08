/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/underscore');
  var api = require('api');
  var settings = require('settings');

  return function (app, repsonseContainerId) {
    var template = _.template($('#response-info-template').html());
    var showReponses = function(data) {
      console.log("Got responses:", data);
      var $t = $(template(data));
      console.log($t);
      $('#responses').html($t);
      $('#responses').trigger("create");
    };

    var fail = function(error) {
      console.error("Error getting responses", error);
    };

    var getResponses = function(event) {
      console.log("Checking for responses for", event, app.selectedObject);
      var $request = api.getResponsesForObject(app.selectedObject.id);
      $request.done(showReponses);
      $request.fail(fail);

      // clear out existing data.
      $('#response-template').html('');
    };

    this.init = function(){
      console.log("Initialize response listener");

      // Listen for objectedSelected, triggered when items on the map are tapped
      $.subscribe("objectSelected", getResponses);
    };

    // Trigger init .........................................................
    this.init();

  };
});
