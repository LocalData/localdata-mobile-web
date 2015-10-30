/*jslint nomen: true */
/*globals define, FormData: true */

define(function (require) {
  'use strict';

  var settings = require('settings');
  var _ = require('lib/underscore');
  var $ = require('jquery');
  var Lawnchair = require('lawnchair');
  var Promise = require('lib/bluebird');

  var cache = true;

  if (window.useCacheBuster) {
    cache = false;
  }

  var api = {};

  var PING_INTERVAL = 10000; // 10 seconds
  var PING_TIMEOUT = 5000; // 5 seconds

  // Local storage for responses, in case of connectivity issues
  var responseDB = null;

  // Lawnchair doesn't follow the node callback convention, so we use this
  // helper function to promisify various database methods.
  function promisifyLawnchair(db, fn) {
    return function () {
      var args = new Array(arguments.length + 1);
      var i;
      for (i = 0; i < args.length - 1; i += 1) {
        args[i] = arguments[i];
      }

      var promise = new Promise(function (resolve, reject) {
        args[args.length - 1] = resolve;
        fn.apply(db, args);
      });

      return promise;
    };
  }

  var getKeys;
  var getDoc;
  var removeDoc;
  var saveDoc;

  // Initialize the API module.
  // Set up the local database.
  // @param {Function} done Called with null if initialization went smoothly.
  api.init = function init(done) {
    var lawnchair = new Lawnchair({ name: 'responseDB' }, function (db) {
      responseDB = db;

      getKeys = promisifyLawnchair(responseDB, responseDB.keys);
      getDoc = promisifyLawnchair(responseDB, responseDB.get);
      removeDoc = promisifyLawnchair(responseDB, responseDB.remove);
      saveDoc = promisifyLawnchair(responseDB, responseDB.save);

      api.online = true;
      done(null);
    });
  };

  // Make periodic tiny GET requests to see if we're back online.
  var pingId = null;
  function startPinging() {
    pingId = setInterval(function ping() {
      $.ajax({
        url: '/mobile/index.html',
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
    _.each(response.files, function (item) {
      var f = $.canvasResize('dataURLtoBlob', item.data);
      f.name = item.name;
      fd.append(item.fieldName, f, f.name);
    });

    // Remove the file data from the response object, since we will include
    // it as part of a multipart request body.
    delete response.files;

    // Responses need to be added as a string :-\
    fd.append('data', JSON.stringify({ responses: [response] }));

    return Promise.resolve($.ajax({
      url: api.getSurveyURL() + '/responses',
      type: 'POST',
      data: fd,
      dataType: 'json',
      contentType: false,
      processData: false,
      headers: {
        pragma: 'no-cache'
      }
    }));
  }

  // Post a response, with no attached file, as application/json data.
  // Return a promise for the jQuery ajax operation.
  function postPlain(response) {
    return Promise.resolve($.ajax({
      url: api.getSurveyURL() + '/responses',
      type: 'POST',
      data: JSON.stringify({ responses: [response] }),
      headers: {
        pragma: 'no-cache'
      },
      contentType: 'application/json; charset=utf-8'
    }));
  }

  // Sync all of the locally-saved responses to the server.
  api.postSavedResponses = function postSavedResponses() {
    // FIXME: The responses could correspond to different surveys.
    getKeys()
    .then(function (keys) {
      $.publish('syncingResponses');
      return Promise.map(keys, function (key) {
        return getDoc(key)
        .then(function (doc) {
          var response = doc.response;

          // POST a response.
          if (response.files !== undefined) {
            return postMultipart(response);
          }
          return postPlain(response);
        }).then(function () {
          // If the POST was successful, remove the document from the local DB.
          return removeDoc(key);
        });
      }, {
        concurrency: 1
      }).then(function () {
        // If all of the POSTs were successful, then we can indicate that
        // syncing has completed. Otherwise, we'll still be offline.
        $.publish('syncedResponses');
      }).catch(function (error) {
        // TODO: distinguish between errors (timeout vs. 500)
        console.error('Failed to save an entry! Going offline. Error: ' + error);
        api.online = false;
      });
    });
  };

  // Save the response locally, in case of failure.
  function saveAndPost(response) {
    // First save the data locally.
    // Return a promise for the save. Once that completes, the rest of the UI
    // can move on, and we can handle the post+removal asynchronously.
    // TODO: We might need to use an explicit queue for POSTing saved
    // documents. If the user submits an entry with a large photo attachment,
    // we could go into offline mode and then come back online before that POST
    // completes. Then we'll see the saved document and try submitting it, even
    // though the first attempt is in progress.
    var promise = saveDoc({
      response: response
    });

    promise.bind({}).then(function (doc) {
      if (!api.online) {
        return;
      }

      this.doc = doc;

      // We're online, so try POSTing the data.
      if (response.files !== undefined) {
        // Post a response and file as multipart form data.
        return postMultipart(response);
      }
      return postPlain(response);
    }).then(function () {
      // Remove the data from our local cache.
      responseDB.remove(this.doc.key, function () {
        // Wait until we've removed the document before setting the online
        // status. If we go from offline to online, we'll try sending all of
        // the locally-saved documents.
        api.online = true;
      });
    }).catch(function (error) {
        // TODO: differentiate between serious errors (like 404 Not Found) and
        // connectivity issues.
        api.online = false;
    });

    return promise;
  }

  // Save a single response, for the current survey, to the server.
  // @param {Object} response A response object for the API
  // @param {Array} files An array of file objects to attach to the response
  api.postResponse = function postResponse(response, files) {
    if (files !== undefined && files.length > 0) {
      console.log('Attaching ' + files.length + ' files.');

      return Promise.map(files, function (item) {
        return (new Promise(function (resolve, reject) {
          // Resize the image as needed
          $.canvasResize(item.file, {
            width: 800,
            height: 0,
            crop: false,
            quality: 85,
            callback: function (data, width, height) {
              // Attach the resized image as a data URI.
              var resized = {
                fieldName: item.fieldName,
                name: item.file.name,
                data: data
              };

              resolve(resized);
            }
          });
        }));
      }).then(function (resizedFiles) {
        // Attach the array of image data to the response.
        response.files = resizedFiles;
        return saveAndPost(response);
      });
    }

    // No files to attach.

    // Sanity check
    if (files !== undefined) {
      console.error('Empty files array!');
    }

    return saveAndPost(response);
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
        console.log("Setting survey: ", settings.survey);
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

  api.getObjectDataURL = function(options) {
    return settings.api.baseurl + '/objects.geojson?source=' + options.source;
  };

  api.getForm = function(callback) {
    console.log('Getting form data');
    var url = api.getSurveyURL() + '/forms';

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

        console.log("Got form data: ", mobileForms);

        // Endpoint should give the most recent form first.
        callback();
      }
    });
  };
  
  api.getTileJSON = function getTileJSON() {
    return $.ajax({
      url: '/tiles/features/tile.json',
      type: 'GET',
      dataType: 'json',
      cache: false,
      data: {
        layerDefinition: JSON.stringify({
          query: {
            type: 'parcels'
          },
          styles: settings.renderedStyles
        })
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
  api.geocodeAddress = function (address, callback) {
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
    var geocodeEndpoint = '//dev.virtualearth.net/REST/v1/Locations/' + addressWithLocale + '?o=json&key=' + settings.bing_key + '&jsonp=?';

    return Promise.resolve($.ajax({
      url: geocodeEndpoint,
      dataType: 'json',
      cache: cache
    })).then(function (data) {
      if (data.resourceSets.length > 0 &&
          data.resourceSets[0].resources.length > 0){
        var result = data.resourceSets[0].resources[0];
        return {
          addressLine: result.address.addressLine,
          coords: [result.point.coordinates[1], result.point.coordinates[0]]
        };
      }

      throw {
        type: 'GeocodingError',
        message: 'No geocoding results found'
      };
    }).nodeify(callback);
  };

  api.reverseGeocode = function (lng, lat, done) {
    $.ajax({
      url: '//dev.virtualearth.net/REST/v1/Locations/' + lat + ',' + lng,
      dataType: 'jsonp',
      jsonp: 'jsonp',
      data: {
        includeEntityTypes: 'Address',
        key: settings.bing_key
      },
      cache: cache,
    }).then(function (data) {
      if (!data.resourceSets || data.resourceSets.length === 0) {
        done(null, null);
        return;
      }

      var resources = data.resourceSets[0].resources;
      if (!resources || resources.length === 0) {
        done(null, null);
        return;
      }

      var address = resources[0].address;
      if (!address || !address.addressLine) {
        done(null, null);
        return;
      }

      done(null, {
        shortName: address.addressLine,
        longName: address.formattedAddress
      });
    }).fail(function (error) {
      done(error);
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
  // @param {Object} options Can include a source, which defines the data source as a URL
  //    Source must include a string like ?bbox={{bbox}}
  // @param {Function} callback Expects a list of features & attributes
  // @param {Function} callback With two parameters, error and results, a
  // GeoJSON FeatureCollection
  api.getObjectsInBBox = api.getObjectsInBBoxFromLocalData = function(bbox, options, callback) {
    // Given the bounds, generate a URL to get the responses from the API.
    // Support a single source or a list of sources. Fall back to the parcels
    // endpoint.
    var urls;
    if (options.source && !_.isArray(options.source)) {
      urls = [options.source.replace('{{bbox}}', bbox.join(','))];
    } else if (options.source) {
      urls = _.map(options.source, function (source) {
        return source.replace('{{bbox}}', bbox.join(','));
      });
    } else {
      urls = [settings.api.geo + '/parcels.geojson?bbox=' + bbox.join(',')];
    }

    // Get geo objects from the API. Don't force non-caching on IE, since these
    // should rarely change and could be requested multiple times in a session.
    // If we're in offline mode, don't wait around forever for base layer
    // objects.
    var timeout = 0;
    if (!api.online) {
      timeout = 10000;
    }
    Promise.map(urls, function (url) {
      // Give the callback the responses.
      return $.ajax({
        url: url,
        dataType: 'json',
        type: 'GET',
        timeout: timeout
      });
    }).reduce(function (memo, data) {
      if (data) {
        return memo.concat(data.features);
      }
      return memo;
    }, []).then(function (features) {
      callback(null, {
        type: 'FeatureCollection',
        features: features
      });
    }).catch(function (error) {
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
    if(geometry.x) {
      // This is a point.
      var point = {
        type: 'Point',
        coordinates: [geometry.x, geometry.y]
      };
      return point;
    }


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
