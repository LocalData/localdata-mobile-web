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
    /*
     * Show the survey & hide the front page after the sign-in form has been
     * submitted
     */
    init: function () {
      console.log("Initialize NSB");

      appCacheManager.init(function () {
        // Get the survey, slug, etv.
        var surveyPromise = api.getSurveyFromSlug();

        $('#loading-container').remove();
        $('#home-container').show();
        var $collectorName = $('#collector_name');
        var $collectorNameSubmit = $('#collector-name-submit');

        // Set the collector name, if we already know it.
        if ($.cookie('collectorName') !== null){
          $collectorName.val($.cookie('collectorName'));
        }

        $collectorNameSubmit.click(function(event) {
          $('#startpoint h2').html('Loading your survey');

          // Set a cookie with the collector's name
          console.log("Setting collector name");
          app.collectorName = $collectorName.val();
          $.cookie('collectorName', app.collectorName, { path: '/' });

          // Hide the homepage, show the survey
          $('#home-container').hide();
          $('#survey-container').show();

          // TODO: think this is deprecated / no longer necessary.
          $('body').attr('id', 'survey');

          // Wait until we have the survey data
          surveyPromise
          .done(function (survey) {
            api.init(function (error) {
              if (error) {
                $('#startpoint h2').html('Sorry, something went wrong. Please reload the page.');
                return;
              }

              setupEventHandlers();

              if (survey.type === 'point') {
                $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Pan and add a point to begin');
              } else if (survey.type === 'address-point') {
                $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Enter an address to begin');
              } else {
                $('#startpoint h2').html('Welcome, ' + app.collectorName + '<br>Tap a parcel to begin');
              }

              app.map = new MapView(app, 'map-div');
              app.f = new FormView(app, '#form');

              if (survey.type === 'address-point') {
                $.publish('readyForAddressForm');
              }
            });
          })
          .fail(function (jqXHR) {
            if (jqXHR.status === 404) {
              // Survey was not found
              $('#startpoint h2').html('Sorry, we couldn\'t find the survey. Please check the URL or contact the survey organizer.');
            } else {
              // Unknown error
              $('#startpoint h2').html('Sorry, something has gone wrong. Please try again in a bit or contact the survey organizer.');
            }
          });
        });
      });
    },

    // We'll use this to keep track of the object currently selected in the app
    selectedObject: {}
  };

  return app;
});
