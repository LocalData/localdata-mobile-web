/*jslint nomen: true */
/*globals define: true */

/* 
 * Basic app functionality for the mobile survey. 
 */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var api = require('api');
  var FormView = require('form');
  var MapView = require('map');

  var app = {
    /* 
     * Show the survey & hide the front page after the sign-in form has been 
     * submitted
     */
    init: function () {
      console.log("Initialize NSB");

      // Get the survey, slug, etv.
      var surveyPromise = api.getSurveyFromSlug();

      // Set the collector name, if we already know it.
      if ($.cookie('collectorName') !== null){
        $("#collector_name").val($.cookie('collectorName'));
      }

      $("#collector-name-submit").click(function(event) {
        console.log("Setting collector name");

        app.collectorName = $("#collector_name").val();

        $('#startpoint h2').html('Loading...');

        $('.collector').val(app.collectorName);

        // Set a cookie with the collector's name
        $.cookie('collectorName', app.collectorName, { path: '/' });

        // Hide the homepage, show the survey
        $('#home-container').slideToggle();
        $('#survey-container').slideToggle();
        $('body').attr('id', 'survey');

        // Wait until we have the survey data
        surveyPromise.done(function (error, survey) {
          console.log("DONE", error, survey);
          // If we don't have a survey, let the user know there's a problem
          if (error) {
            console.log("Survey not found");
            $('#login').fadeOut(function() {
              $('#notfound').fadeIn();
            });
          }

          // Set up the intro messages to match the survey type.
          if (survey.type === 'point') {
            $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Pan and add a point to begin');
          } else {
            $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Tap a parcel to begin');
          }

          app.map = new MapView(app, 'map-div');
          app.f = new FormView(app, '#form');
        });

      });
    },

    // We'll use this to keep track of the object currently selected in the app
    selectedObject: {}
  };

  return app;
});
