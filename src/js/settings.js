/*globals define: true */

define(function (require) {
  'use strict';

  var L = require('lib/leaflet');

  return {
    // ID of the current survey -- set on init.
    surveyid: '',

    // URLs of services used to store, retrieve survey data
    api: {
      baseurl: '/api', //'http://localhost:3000', // 'http://surveydet.herokuapp.com', // no trailing slash
      geo: '/api'
    },

    // Keys for external services
    // In the future, we should move these out to a separate, untracked file
    // Right now, the danger is low.
    bing_key: 'Arc0Uekwc6xUCJJgDA6Kv__AL_rvEh4Hcpj4nkyUmGTIx-SxMd52PPmsqKbvI_ce',

    icons: {
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
    },

    styles: {
      defaultStyle: {
        'opacity': 1,
        'fillOpacity': 0,
        'weight': 1.5,
        'color': 'white'
      },

      selectedStyle: {
        'opacity': 1,
        'fillOpacity': 0.25,
        'weight': 3,
        'color': '#fffa00',
        'fillColor': '#fffa00',
        'dashArray': '1'
      },

      completedStyle: {
        opacity: 0.7,
        fillOpacity: 0.25,
        weight: 2,
        color: '#42ad22',
        fillColor: '#42ad22',
        dashArray: '1'
      },

      pendingStyle: {
        opacity: 0.7,
        fillOpacity: 0.25,
        weight: 1.5,
        color: '#58aeff',
        fillColor: '#58aeff',
        dashArray: '1'
      },

      staleParcelStyle: {
        'opacity': 1,
        'fillOpacity': 0,
        'weight': 2,
        'color': 'orange',
        'dashArray': '1'
      }
    }
  };
});
