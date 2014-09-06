/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/underscore');
  var api = require('api');
  var settings = require('settings');

  return function (app, repsonseContainerId) {
    this.init = function(){
      console.log("Initialize response listener");

      // Listen for objectedSelected, triggered when items on the map are tapped
      $.subscribe("objectSelected", this.getResponses);
    };

    this.getResponses = function(a, b, c) {
      console.log(a, b, c, app.selectedObject);
    };

    this.showReponses = function() {

    };

    // Trigger form init .........................................................
    this.init();

  };
});
