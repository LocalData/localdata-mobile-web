/*globals define: true */

define(function (require) {
  'use strict';

  var L = require('lib/leaflet');

  var settings = {};

  // ID of the current survey -- set on init.
  settings.surveyid =  '';

  // URLs of services used to store, retrieve survey data
  settings.api = {
    baseurl: '/api', //'http://localhost:3000', // 'http://surveydet.herokuapp.com', // no trailing slash
    geo: '/api'
  };

  // Keys for external services
  // In the future, we should move these out to a separate, untracked file
  // Right now, the danger is low.
  settings.bing_key = 'Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce';

  settings.icons = {
    CheckIcon: L.Icon.extend({
      options: {
        className: 'CheckIcon',
        iconUrl: 'img/icons/check-16.png',
        shadowUrl: 'img/icons/check-16.png',
        iconSize: new L.Point(16, 16),
        shadowSize: new L.Point(16, 16),
        iconAnchor: new L.Point(8, 8),
        popupAnchor: new L.Point(8, 8)
      }
    }),

    PlaceIcon: L.icon({
      className: 'PlaceIcon',
      iconUrl: 'img/icons/plus-24.png',
      shadowUrl: 'img/icons/plus-24.png',
      iconSize: new L.Point(25, 25),
      shadowSize: new L.Point(25, 25),
      iconAnchor: new L.Point(13, 13),
      popupAnchor: new L.Point(13, 13)
    }),

    CrosshairIcon: L.icon({
      className: 'CrosshairIcon',
      iconUrl: 'js/lib/leaflet/images/marker-icon.png',
      shadowUrl: 'js/lib/leaflet/images/marker-shadow.png',
      iconSize: new L.Point(25, 41),
      shadowSize: new L.Point(41, 41),
      iconAnchor: new L.Point(12, 41),
      popupAnchor: new L.Point(25, 25)
    })
  };

  var defaultColor = 'white';
  var selectedColor = '#fffa00';
  var completedColor = '#42ad22';
  var pendingColor = '#58aeff';
  var staleColor = 'orange';

  settings.styles = {
    default: {
      polygon: {
        opacity: 1,
        fillOpacity: 0,
        weight: 1.5,
        color: defaultColor
      },
      lineString: {
        opacity: 1,
        weight: 10,
        color: defaultColor
      }
    },

    selected: {
      polygon: {
        opacity: 1,
        fillOpacity: 0.25,
        weight: 3,
        color: selectedColor,
        fillColor: selectedColor,
        dashArray: '1'
      },
      lineString: {
        opacity: 1,
        weight: 10,
        color: selectedColor
      }
    },

    completed: {
      polygon: {
        opacity: 0.7,
        fillOpacity: 0.25,
        weight: 2,
        color: completedColor,
        fillColor: completedColor,
        dashArray: '1'
      },
      lineString: {
        opacity: 1,
        weight: 10,
        dashArray: '1',
        color: completedColor
      }
    },

    pending: {
      polygon: {
        opacity: 0.7,
        fillOpacity: 0.25,
        weight: 1.5,
        color: pendingColor,
        fillColor: pendingColor,
        dashArray: '1'
      },
      lineString: {
        opacity: 1,
        weight: 10,
        dashArray: '1',
        color: pendingColor
      }
    },

    stale: {
      polygon: {
        opacity: 1,
        fillOpacity: 0,
        weight: 2,
        color: staleColor,
        dashArray: '1'
      },
      lineString: {
      }
    }
  };

  return settings;
});
