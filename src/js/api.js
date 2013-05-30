/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var settings = require('settings');
  var _ = require('lib/underscore');
  var $ = require('jquery');
  var L = require('lib/leaflet');
  var Lawnchair = require('lawnchair');

  var cache = true;

  if (window.useCacheBuster) {
    cache = false;
  }

  var api = {};

  var PING_INTERVAL = 10000; // 10 seconds
  var PING_TIMEOUT = 5000; // 5 seconds

  // Local storage for responses, in case of connectivity issues
  var responseDB = null;

  // Initialize the API module.
  // Set up the local database.
  // @param {Function} done Called with null if initialization went smoothly.
  api.init = function init(done) {
    var lawnchair = new Lawnchair({ name: 'responseDB' }, function (db) {
      responseDB = db;
      api.online = true;
      done(null);
    });
  };

  // Make periodic tiny GET requests to see if we're back online.
  var pingId = null;
  function startPinging() {
    pingId = setInterval(function ping() {
      $.ajax({
        url: '/index.html',
        cache: false,
        type: 'HEAD',
        timeout: PING_TIMEOUT
      }).done(function () {
        api.online = true;
      }).fail(function (error) {
        api.online = false;
      });
    }, PING_INTERVAL);
  }

  function stopPinging() {
    if (pingId !== null) {
      clearInterval(pingId);
      pingId = null;
    }
  }

  // Expose our online vs. offline status.
  // api.online
  var onlineValue = false;
  Object.defineProperty(api, 'online', {
    get: function () { return onlineValue; },
    set: function (value) {
      if (onlineValue !== value) {
        onlineValue = value;
        if (value === false) {
          // We switched to OFFLINE mode.
          console.info('Going offline');

          // Announce it to the world!
          $.publish('offline');

          // Kick off the periodic ping to see if we're back online.
          startPinging();
        } else {
          // We switched to ONLINE mode.
          console.info('Coming back online');

          // Cancel the periodic ping.
          stopPinging();

          // Send the responses that we stored locally.
          api.postSavedResponses();

          // Announce it to the world!
          $.publish('online');
        }
      }
    }
  });

  $(document).ajaxError(function globalErrorHandler(event, jqXHR, settings, error) {
    // TODO: If we get a 500, 404, etc. response, then we're in a different
    // situation than just poor connectivity.
    api.online = false;
  });

  api.getSavedResponses = function getSavedResponses(done) {
    try {
      responseDB.all(function (docs) {
        done(null, _.pluck(docs, 'response'));
      });
    } catch (e) {
      done(e);
    }
  };

  // Post a response and a file as multipart form data.
  // Return a promise for the jQuery ajax operation.
  function postMultipart(response) {
    // Get ready to submit the data
    var fd = new FormData();

    // ... and add the file data
    // TODO: support multiple files
    var f = $.canvasResize('dataURLtoBlob', response.files[0].data);
    f.name = response.files[0].name;
    fd.append(response.files[0].fieldName, f, f.name);

    // Remove the file data from the response object, since we will include
    // it as part of a multipart request body.
    delete response.files;

    // Responses need to be added as a string :-\
    fd.append('data', JSON.stringify({ responses: [response] }));

    return $.ajax({
      url: api.getSurveyURL() + '/responses',
      type: 'POST',
      data: fd,
      dataType: 'json',
      contentType: false,
      processData: false,
      headers: {
        pragma: 'no-cache'
      }
    });
  }

  // Post a response, with no attached file, as application/json data.
  // Return a promise for the jQuery ajax operation.
  function postPlain(response) {
    return $.ajax({
      url: api.getSurveyURL() + '/responses',
      type: 'POST',
      data: JSON.stringify({ responses: [response] }),
      headers: {
        pragma: 'no-cache'
      },
      contentType: 'application/json; charset=utf-8'
    });
  }

  // Sync all of the locally-saved responses to the server.
  api.postSavedResponses = function sendSavedResponses() {
    // FIXME: The responses could correspond to different surveys.
    // FIXME: If we've attached image data, we need to create multipart form data and submit responses individually.
    responseDB.keys(function (keys) {
      if (keys.length === 0) {
        return;
      }
      var data = { responses: [] };
      responseDB.get(keys, function (doc) {
        $.publish('syncingResponses');

        data = { responses: _.pluck(doc, 'response') };

        var hasFiles = _.any(data.responses, function (item) {
          return item.files !== undefined;
        });

        if (!hasFiles) {
          // No files to upload, so we can post the responses in one batch.
          $.ajax({
            url: api.getSurveyURL() + '/responses',
            type: 'POST',
            data: JSON.stringify(data),
            headers: {
              pragma: 'no-cache'
            },
            contentType: 'application/json; charset=utf-8'
          })
          .fail(function (error) {
            api.online = false;
          })
          .done(function (data) {
            // Sanity check
            if (data.responses.length !== keys.length) {
              console.error('We tried to save ' + keys.length + ' responses but only got ' + data.responses.length + ' back from the server!');
            }
            // Remove the documents from the local DB.
            responseDB.remove(keys, function () {
              $.publish('syncedResponses');
            });
          });
        } else {
          // We need to upload files, so we must post responses one by one.
          var count = data.responses.length;
          _.each(data.responses, function (response) {
            var promise;

            // POST a response.
            if (response.files !== undefined) {
              promise = postMultipart(response);
            } else {
              promise = postPlain(response);
            }

            // Handle completion of the POST.
            promise
            .fail(function (jqXHR, textStatus, errorThrown) {
              // TODO: distinguish between errors (timeout vs. 500)
              // TODO: If we've saved some entries, remove those from the local DB.
              console.error('Failed to save an entry! Going offline. Error: ' + errorThrown);
              api.online = false;
            })
            .always(function () {
              count -= 1;
              if (count === 0) {
                // We've saved each response to the server. We can remove them from our local DB.

                // Remove the documents from the local DB.
                responseDB.remove(keys, function () {
                  $.publish('syncedResponses');
                });
              }
            });

          });
        }

      });
    });
  };

  // Save the response locally, in case of failure.
  function saveAndPost(response) {
    // First save the data locally.
    responseDB.save({ response: response }, function (doc) {
      // If we're offline, don't do anything.
      if (!api.online) {
        return;
      }

      var url = api.getSurveyURL() + '/responses';
      var promise;

      // We're online, so try POSTing the data.
      if (response.files !== undefined) {
        // Post a response and file as multipart form data.
        promise = postMultipart(response);
      } else {
        promise = postPlain(response);
      }

      // Handle success and failure.
      promise
      .fail(function (error) {
        // TODO: differentiate between serious errors (like 404 Not Found) and
        // connectivity issues.
        api.online = false;
      })
      .done(function () {
        // Remove the data from our local cache.
        responseDB.remove(doc.key, function () {
          // Wait until we've removed the document before setting the online
          // status. If we go from offline to online, we'll try sending all of
          // the locally-saved documents.
          api.online = true;
        });
      });

    });
  }

  // Save a single response, for the current survey, to the server.
  // @param {Object} response A response object for the API
  // @param {Array} files An array of file objects to attach to the response
  api.postResponse = function postResponse(response, files) {
    if (files !== undefined && files.length > 0) {
      if (files.length > 1) {
        console.error('We do not yet support attaching multiple files!');
      }

      // Resize the image as needed
      $.canvasResize(files[0].file, {
        width: 800,
        height: 0,
        crop: false,
        quality: 100,
        callback: function(data, width, height) {
          // Attach the resized image, as a data URI, to the response object.
          response.files = [{
            fieldName: files[0].fieldName,
            name: files[0].file.name,
            data: data
          }];

          saveAndPost(response);
        }
      });
    } else {
      // No files to attach.

      // Sanity check
      if (files !== undefined) {
        console.error('Empty files array!');
      }

      saveAndPost(response);
    }
  };

  // Returns a promise for the survey data.
  // TODO: manage the errors, so the caller doesn't have to know about jqXHR
  // and can just look for an error named NotFoundError or similar.
  api.getSurveyFromSlug = function getSurveyFromSlug() {
    var slug = window.location.hash.slice(1);
    
    var url = settings.api.baseurl +  '/slugs/' + slug;
    console.log('Retrieving survey id from ' + url);
    
    // Get the survey ID
    return $.ajax({
      url: url,
      dataType: 'json',
      cache: cache
    })
    .then(function (data) {
      settings.surveyId = data.survey;

      // Actually get the survey metadata
      var surveyUrl = api.getSurveyURL();
      return $.ajax({
        url: surveyUrl,
        dataType: 'json',
        cache: cache
      })
      .then(function (survey) {
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
    return settings.api.baseurl + '/surveys/' + settings.surveyId + '/responses?objectId=' + parcel_id;
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
  // @param {Object} bbox A bounding box specified as an array of coordinates:
  // [[west, south], [east, north]]
  // @param {Function} callback Expects a list of features & attributes
  api.getResponsesInBBox = function(bbox, callback) {
    // Given the bounds, generate a URL to ge the responses from the API.
    var serializedBounds = bbox.join(',');
    var url = api.getSurveyURL() + '/responses?bbox=' + serializedBounds;

    // If we likely have poor connectivity, let's not spend forever waiting for
    // these responses.
    var timeout = 0;
    if (!api.online) {
      timeout = 10000;
    }

    // Fetch responses and hand them to the callback.
    $.ajax({
      url: url,
      dataType: 'json',
      type: 'GET',
      timeout: timeout,
      cache: cache
    })
    .done(function (data) {
      callback(data.responses);
    })
    .fail(function (error) {
      console.warn('Error fetching responses in a bounding box: ' + error.name);
      console.warn(error.message);
      callback([]);
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
    // If we're in offline mode, don't wait around forever for base layer
    // objects.
    var timeout = 0;
    if (!api.online) {
      timeout = 10000;
    }
    // Give the callback the responses.
    $.ajax({
      url: url,
      dataType: 'json',
      type: 'GET',
      timeout: timeout
    })
    .done(function (data) {
      if (data) {
        callback(null, data);
      } else {
        callback({
          type: 'APIError',
          message: 'Got no data from the LocalData geo endpoint'
        });
      }
    })
    .fail(function (error) {
      console.warn('Failed to fetch objects in a bounding box: ' + error.name);
      console.warn(error.message);
      callback({
        type: 'APIError',
        message: 'Error fetching data from the LocalData geo endpoint'
      });
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
