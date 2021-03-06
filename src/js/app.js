/*jslint nomen: true */
/*globals define: true */

/*
 * Basic app functionality for the mobile survey.
 */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var api = require('api');
  var Promise = require('lib/bluebird');
  var surveyPage = require('survey-page');
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
      event.preventDefault();

      var $collectorName = $('#collector_name');
      // Set a cookie with the collector's name
      // TODO make sure this
      settings.collectorName = $collectorName.val();
      $.cookie('collectorName', settings.collectorName, { path: '/' });

      if (settings.collectorName === '') {
        $collectorName.addClass('error');
        return;
      }

      // Switch to the survey container
      // We wait until the page is successfully created to initialize the map
      $('#survey-container').on("pageshow", function(event) {
        app.surveyPage = surveyPage;
        surveyPage.init({
          mapContainer: $('#map-div'),
          form: $('#form')
        });
      });
      $('body').pagecontainer('change', '#survey-container', {changeHash: false});

      $('h1').html(settings.survey.name);

      // Set up the online / offline event handlers
      setupEventHandlers();

      // Give the correct welcome
      // TODO: templatize for i18n
      if (settings.survey.type === 'point') {
        $('#startpoint h2').html('Welcome, ' + settings.collectorName + '<br>Pan and add a point to begin');
      } else if (settings.survey.type === 'address-point') {
        $('#startpoint h2').html('Welcome, ' + settings.collectorName + '<br>Enter an address to begin');
      } else {
        $('#startpoint h2').html('Welcome, ' + settings.collectorName + '<br>Tap a parcel to begin');
      }

      // Use a custom prompt, if any
      if (settings.survey.surveyOptions && settings.survey.surveyOptions.prompt) {
        $('#startpoint h2').html('Welcome, ' + settings.collectorName + '<br>' + settings.survey.surveyOptions.prompt);
      }

      if (settings.survey.type === 'address-point') {
        $.publish('readyForAddressForm');
      }
    },

    /*
     * We got the survey data
     * The survey is now exposed via settings.survey
     */
    setupSurvey: function (survey) {
      $('#survey-title').html(survey.name);
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

        // Capture clicks on the "Get started" button as well as Enter-presses
        // from the input box.
        $collectorNameSubmit.click(app.getStarted);
        $('#welcome-form').submit(app.getStarted);
      });
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
        Promise.resolve(api.getSurveyFromSlug())
        .then(app.setupSurvey)
        .catch(function (error) {
          if (error.status && error.status === 404) {
            // Survey was not found
            $('#loading-msg').html('Sorry, we couldn\'t find the survey. Please check the URL or contact the survey organizer.');
          } else {
            // Unknown error
            $('#loading-msg').html('Sorry, something has gone wrong. Please try again in a bit or contact the survey organizer.');
          }
        });

      }); // end appcache manager
    }
  };

  return app;
});
