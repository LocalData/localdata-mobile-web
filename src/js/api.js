/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var settings = require('settings');
  var _ = require('lib/underscore');
  var $ = require('jquery');
  var L = require('lib/leaflet');

  var cache = true;

  var api = {};

  if (window.useCacheBuster) {
    cache = false;
  }

  api.getSurveyFromSlug = function() {
    var slug = window.location.hash.slice(1);
    
    var url = settings.api.baseurl +  '/slugs/' + slug;
    console.log("I'm using this URL to get ");
    console.log(url);
    
    // TODO: Display a nice error if the survey wans't found.
    // TODO: Instead of deferred.pipe(), we should upgrade to jQuery >= 1.8 or
    // use Q
    return $.ajax({
      url: url,
      dataType: 'json',
      cache: cache
    })
    .pipe(function (data) {
      settings.surveyId = data.survey;

      // Actually get the survey metadata
      var surveyUrl = api.getSurveyURL();
      return $.ajax({
        url: surveyUrl,
        dataType: 'json',
        cache: cache
      })
      .pipe(function (survey) {
        settings.survey = survey.survey;
        console.log(settings.survey);
        return settings.survey;
      });

    });
  };
  
  /*
   * Generates the URL to retrieve results for a given parcel
   */
  api.getSurveyURL = function() {
    return settings.api.baseurl + '/surveys/' + settings.surveyId;
  };
  
  api.getParcelDataURL = function(parcel_id) {
    return settings.api.baseurl + '/surveys/' + settings.surveyId + '/parcels/' + parcel_id + '/responses';
  };
  
  // Deprecated
  // api.getGeoPointInfoURL = function(lat, lng) {
  //   return settings.api.geo + '/parcels/parcel?lat=' + lat + '&lng=' + lng;
  // };
  
  api.getGeoBoundsObjectsURL = function(bbox) {
    return settings.api.geo + '/parcels.geojson?bbox=' + bbox.join(',');
  };
  
  api.getForm = function(callback) {
    console.log('Getting form data');
    var url = api.getSurveyURL() + '/forms';
    
    console.log(url);

    $.ajax({
      url: url,
      dataType: 'json',
      cache: cache,
      success: function (data){
        // Get only the mobile forms
        var mobileForms = _.filter(data.forms, function(form) {
          if (_.has(form, 'type')) {
            if (form.type === 'mobile'){
              return true;
            }
          }
          return false;
        });
        settings.formData = mobileForms[0];
        
        console.log('Mobile forms');
        console.log(mobileForms);
        
        // Endpoint should give the most recent form first.
        callback();
      }
    });
  };

  
  // Deal with the formatting of the geodata API.
  // In the future, this will be more genericized.
  // parcel_id => object_id
  // address => object_location
  api.parseObjectData = function(data) {
    return {
      parcelId: data.parcelId,
      address: data.address,
      polygon: data.polygon,
      centroid: data.centroid
    };
  };
  
  // Take an address string.
  // callback(error, data)
  // data contains addressLine and coords (a lng-lat array)
  api.codeAddress = function (address, callback) {
    console.log('Coding an address');
    console.log(address);

    // TODO: Can we get the locale from the geolocation feature?
    // If the user-entered address does not include a city, append the survey location.
    var addressWithLocale = address;
    if (settings.survey.location !== undefined && settings.survey.location.length > 0) {
      // If there is a comma in the address, assume the user added the city.
      if (address.indexOf(',') === -1) {
        // See if the survey location is part of the user-entered address.
        // Assume survey location is of the form "City, State", "City, State, USA", or "City, State ZIP"
        var addressLower = address.toLocaleLowerCase();
        var locationComponents = settings.survey.location.split(',');
        var containsLocale = false;

        // TODO: Check the tail parts of the survey location.

        // Check the first part of the survey location.
        var city = locationComponents[0].toLocaleLowerCase().trim();
        if (addressLower.length >= city.length && addressLower.substr(addressLower.length - city.length, city.length) === city) {
          containsLocale = true;
          // Add the remaining location components.
          addressWithLocale = addressWithLocale + ', ' + locationComponents.slice(1).join(',');
        }

        if (!containsLocale) {
          addressWithLocale = addressWithLocale + ', ' + settings.survey.location;
        }
      }
    }
    var geocodeEndpoint = 'http://dev.virtualearth.net/REST/v1/Locations/' + addressWithLocale + '?o=json&key=' + settings.bing_key + '&jsonp=?';

    $.ajax({
      url: geocodeEndpoint,
      dataType: 'json',
      cache: cache,
      success: function (data) {
        if (data.resourceSets.length > 0){
          var result = data.resourceSets[0].resources[0];
          callback(null, {
            addressLine: result.address.addressLine,
            coords: [result.point.coordinates[1], result.point.coordinates[0]]
          });
        } else {
          callback({
            type: 'GeocodingError',
            message: 'No geocoding results found'
          });
        }
      }
    });
  };
  
  // Get responses to the survey recorded in the given bounds
  //
  // @param {Object} bounds A leaflet map bounds object
  // @param {Function} callback Expects a list of features & attributes
  api.getResponsesInBounds = function(bounds, callback) {
    var southwest = bounds.getSouthWest();
    var northeast = bounds.getNorthEast();
    
    // Given the bounds, generate a URL to ge the responses from the API.
    var serializedBounds = southwest.lng + ',' + southwest.lat + ',' + northeast.lng + ',' + northeast.lat;
    var url = api.getSurveyURL() + '/responses/in/' + serializedBounds;

    // Give the callback the responses.
    $.ajax({
      url: url,
      dataType: 'json',
      cache: cache,
      success: function (data){
        if(data.responses) {
          callback(data.responses);
        }
      }
    });
  };
  
  // Query the GeoAPI for features in the given bounding box
  //
  // @param {Object} bbox A bounding box specified as an array of coordinates:
  // [[west, south], [east, north]]
  // @param {Object} options Not currently used; here for consistency
  // @param {Function} callback Expects a list of features & attributes
  // @param {Function} callback With two parameters, error and results, a
  // GeoJSON FeatureCollection
  api.getObjectsInBBox = function(bbox, options, callback) {
    // Given the bounds, generate a URL to ge the responses from the API.
    var url = api.getGeoBoundsObjectsURL(bbox);

    // Get geo objects from the API. Don't force non-caching on IE, since these
    // should rarely change and could be requested multiple times in a session.
    $.ajax({
      url: url,
      dataType: 'json',
      success: function (data) {
        // Give the callback the responses.
        if(data) {
          callback(null, data);
        } else {
          callback({
            type: 'APIError',
            message: 'Got no data from the LocalData geo endpoint'
          });
        }
      }
    });
  };


  // ESRI stuff

  // Generate a query URL
  // A sample URL might look like this:
  //  http://ags.wingis.org/ArcGIS/rest/services/1_Parcels/MapServer/1/query?
  //  geometryType=esriGeometryEnvelope
  //  &geometry=-89.097769,42.271545,-89.092362,42.274038
  //  &f=json&outFields=*&inSR=4326
  //
  // Sample options might looks like this:
  // {
  //   "type": "ArcGIS Server",
  //   "endpoint": "http://ags.wingis.org/ArcGIS/rest/services/1_Parcels/MapServer/1/",
  //   "name": ["LOPHouseNumber", "LOPPrefixDirectional", "LOPStreetName"],
  //   "id": "PrimaryPIN"
  // }
  //
  // @param {Object} bbox A bounding box specified as an array of coordinates:
  // [[west, south], [east, north]]
  // @param {Object} options Options for the query. Must include:
  //    endpoint: the URL of the needed Arc Server collection
  //    name: an array of keys that, when concatenated, name each location
  //      (eg, 'house number' + 'street name')
  //    id: the primary ID for each location (eg, parcel ID)
  function generateArcQueryURL(bbox, options) {
    var url = options.endpoint;

    // Set the requested fields
    var outFields = _.reduce(options.name, function(memo, field){ return memo + ',' + field; }, options.id);
    url += 'query?' + 'outFields=' + outFields;

    // Add the geometry query
    // Given the bounding box, generate a URL to ge the responses from the API.
    var serializedBounds = bbox.join(',');

    url += '&geometryType=esriGeometryEnvelope';
    url += '&geometry=' + serializedBounds;

    // We want JSON back
    url += '&f=json';

    // Make sure the server know's we're sending EPSG 4326
    // And that we want to get the same back
    url += '&inSR=4326';
    url += '&outSR=4326';

    // And finally, set a callback:
    url += '&callback=?';

    console.log(url);
    return url;
  }

  // Generate a human readable name for a feature.
  // Concatenates attributes together.
  //
  // @param {Object} attributes A set of attributes from an ArcServer feature
  // @param {Object} options A set of options with attribute "name", a list of
  //    1+ string keys
  function generateNameFromAttributes(attributes, options) {
    var address = _.reduce(options.name, function(memo, key) {
      if(attributes[key]) {
        memo = memo + ' ' + attributes[key];
      }
      return memo;
    }, '');
    return address;
  }

  // Generate GeoJSON from ESRI's JSON data format
  //
  // @param {Array} geometry A list of features from a geoserver
  function generateGeoJSONFromESRIGeometry(geometry) {
    var multiPolygon = {
      type: 'MultiPolygon',
      coordinates: []
    };

    _.each(geometry.rings, function(ring) {
      multiPolygon.coordinates.push([ring]);
    });

    return multiPolygon;
  }

  // Given a map bounding box, get the objects in the bbox from the given ESRI
  // server.
  //
  // @param {Object} bbox A bounding box specified as an array of coordinates:
  // [[west, south], [east, north]]
  // @param {Function} callback With two parameters, error and results, a
  // GeoJSON FeatureCollection
  api.getObjectsInBBoxFromESRI = function(bbox, options, callback) {
    var url = generateArcQueryURL(bbox, options);

    // Get geo objects from the ArcServer API. Don't force non-caching on IE,
    // since these should rarely change and could be requested multiple times
    // in a session.
    $.ajax({
      url: url,
      dataType: 'json',
      cache: cache,
      success: function (data){
        if(data) {
          // Create a GeoJSON FeatureCollection from the ESRI-style data.
          var featureCollection = {
            type: 'FeatureCollection'
          };
          featureCollection.features = _.map(data.features, function (item) {
            return {
              type: 'Feature',
              id: item.attributes[options.id],
              geometry: generateGeoJSONFromESRIGeometry(item.geometry),
              properties: {
                address: generateNameFromAttributes(item.attributes, options)
              }
            };
          });

          // Pass the FeatureCollection to the callback.
          callback(null, featureCollection);
        } else {
          callback({
            type: 'APIError',
            message: 'Got no data from the Arc Server endpoint'
          });
        }
      }
    });

  };
    
  return api;
});
