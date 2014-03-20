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
  var appCacheManager = require('app-cache-manager');
  var settings = require('settings');

  // Listen for status-change events and adjust the UI accordingly.
  function setupEventHandlers() {
    var $netStatusOffline = $('#net-status-offline');
    var $netStatusBackOnline = $('#net-status-back');

    $.subscribe('online', function () {
      $netStatusOffline.hide();
      $netStatusBackOnline.hide();
    });
    $.subscribe('offline', function () {
      $netStatusOffline.show();
      $netStatusBackOnline.hide();
    });
    $.subscribe('syncingResponses', function () {
      $netStatusOffline.hide();
      $netStatusBackOnline.show();
    });
    $.subscribe('syncedResponses', function () {
      $netStatusOffline.hide();
      $netStatusBackOnline.hide();
    });
  }

  var app = {

    getStarted: function(event) {
      var $collectorName = $('#collector_name');

      // Switch to the survey container
      // We wait until the page is successfully created to initialize the map
      $('body').on( "pageinit", "#survey-container", function( event ) {
        console.log("Survey container created");
        app.map = new MapView(app, 'map-div');
        app.form = new FormView(app, '#form');
      });
      $('body').pagecontainer('change', '#survey-container ', {changeHash: false});

      // Set a cookie with the collector's name
      app.collectorName = $collectorName.val();
      $.cookie('collectorName', app.collectorName, { path: '/' });

      // Set up the online / offline event handlers
      setupEventHandlers();

      // Give the correct welcome
      // TODO: templatize for i18n
      if (settings.survey.type === 'point') {
        $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Pan and add a point to begin');
      } else if (settings.survey.type === 'address-point') {
        $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Enter an address to begin');
      } else {
        $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Tap a parcel to begin');
      }

      if (settings.survey.type === 'address-point') {
        $.publish('readyForAddressForm');
      }
    },

    /*
     * We got the survey data
     * The survey is now exposed via settings.survey
     */
    success: function() {
      api.init(function (error) {
        if (error) {
          $('body').html('Sorry, something went wrong. Please reload the page.');
          return;
        }

        $('body').pagecontainer('change', '#home-container', {changeHash: false});

        var $collectorName = $('#collector_name');
        var $collectorNameSubmit = $('#collector-name-submit');

        // Set the collector name, if we already know it.
        if ($.cookie('collectorName') !== null){
          $collectorName.val($.cookie('collectorName'));
        }

        // Start when the collector name is submitted
        $collectorNameSubmit.click(app.getStarted);
      });
    },

    /*
     * If we can't get the survey:
     */
    fail: function(jqXHR) {
      if (jqXHR.status === 404) {
        // Survey was not found
        $('#startpoint h2').html('Sorry, we couldn\'t find the survey. Please check the URL or contact the survey organizer.');
      } else {
        // Unknown error
        $('#startpoint h2').html('Sorry, something has gone wrong. Please try again in a bit or contact the survey organizer.');
      }
    },

    /*
     * Start the app.
     * Show the survey & hide the front page after the sign-in form
     * has been submitted
     */
    init: function () {
      console.log("Initializing app");

      appCacheManager.init(function () {
        // Get the survey, slug, etv.
        var surveyPromise = api.getSurveyFromSlug();
        surveyPromise.done(app.success);
        surveyPromise.fail(app.fail);

      }); // end appcache manager
    },

    // We'll use this to keep track of the object currently selected in the app
    selectedObject: {}
  };

  return app;
});
