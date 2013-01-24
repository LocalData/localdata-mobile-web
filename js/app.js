/*jslint nomen: true */
/*globals define: true */

/*
 * Basic app functionality for the mobile survey.
 */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var api = require('api');
  var settings = require('settings');
  var FormView = require('form');
  var MapView = require('map');

  var app = {
    /*
     * Show the survey & hide the front page after the sign-in form has been
     * submitted
     */
    init: function () {
      // Get the survey, slug, etv.
      api.getSurveyFromSlug();

      // Set the collector name, if we already know it.
      if ($.cookie('collectorName') !== null){
        $("#collector_name").val($.cookie('collectorName'));
      }

      $("#collector-name-submit").click(function(event) {
        app.collectorName = $("#collector_name").val();

        if (settings.survey.type === 'point') {
          $("#startpoint h2").html("Welcome, " + app.collectorName);
          $(".add-point-container").show();
          $(".collector").val(app.collectorName);
        }
        if (settings.survey.type !== 'point') {
          $("#startpoint h2").html("Welcome, " + app.collectorName + "<br>Tap a place on the map to begin");
          $(".collector").val(app.collectorName);
        }

        // Set a cookie with the collector's name
        $.cookie("collectorName", app.collectorName, { path: '/' });

        // Hide the homepage, show the survey
        $('#home-container').slideToggle();
        $('#survey-container').slideToggle();
        $("body").attr("id","survey");

        app.map = new MapView(app, 'map-div');
        app.f = new FormView(app, '#form');

      });
    },

    // We'll use this to keep track of the object currently selected in the app
    selectedObject: {}
  };

  return app;
});
