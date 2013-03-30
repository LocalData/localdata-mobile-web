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

  // Listen for status-change events and adjust the UI accordingly.
  function setupEventHandlers() {
    var $onlineStatus = $('#online-status');
    var $netActivity = $('#net-activity');

    $.subscribe('online', function () {
      $onlineStatus.removeClass('offline');
    });
    $.subscribe('offline', function () {
      $onlineStatus.addClass('offline');
    });

    // TODO: debounce these so we don't flicker the activity animation
    $(document)
    .ajaxStart(function () {
      $netActivity.addClass('active');
    })
    .ajaxStop(function () {
      $netActivity.removeClass('active');
    });
  }

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
        surveyPromise.done(function (survey) {
          api.init(function (error) {
            if (error) {
              $('#startpoint h2').html('Sorry, something went wrong. Please reload the page.');
              return;
            }

            setupEventHandlers();

            if (survey.type === 'point') {
              $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Pan and add a point to begin');
            } else {
              $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Tap a parcel to begin');
            }

            app.map = new MapView(app, 'map-div');
            app.f = new FormView(app, '#form');
          });
        });
      }); 
    },

    // We'll use this to keep track of the object currently selected in the app
    selectedObject: {}
  };

  return app;
});
