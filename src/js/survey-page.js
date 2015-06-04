/*jslint nomen: true */
/*globals define: true */

/*
 * Handle feature/point selection logic and coordinate interaction between the map view and form view.
 */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/underscore');
  var settings = require('settings');
  var api = require('api');
  var mapView = require('map');
  var formView = require('form');

  var page = {
    multi: false
  };

  var selection;
  var $toolPanel = $('#toolpanel');

  function computeRingCentroid(ring) {
    var off = ring[0];
    var twiceArea = 0;
    var x = 0;
    var y = 0;
    var nPoints = ring.length;
    var p1, p2;
    var f;

    var i, j;
    for (i = 0, j = nPoints - 1; i < nPoints; j = i, i += 1) {
      p1 = ring[i];
      p2 = ring[j];
      f = (p1[1] - off[1]) * (p2[0] - off[0]) - (p2[1] - off[1]) * (p1[0] - off[0]);
      twiceArea += f;
      y += (p1[1] + p2[1] - 2 * off[1]) * f;
      x += (p1[0] + p2[0] - 2 * off[0]) * f;
    }
    f = twiceArea * 3;
    return [x / f + off[0], y / f + off[1]];
  }

  // Compute the centroid of a geometry.
  function computeCentroid(geometry) {
    if (geometry.type === 'MultiPolygon') {
      // TODO: For now we only handle the first polygon.
      return computeRingCentroid(geometry.coordinates[0][0]);
    }

    if (geometry.type === 'Polygon') {
      // TODO: For now we only handle the exterior ring.
      return computeRingCentroid(geometry.coordinates[0]);
    }

    if (geometry.type === 'Point') {
      return _.clone(geometry.coordinates);
    }

    return null;
  }

  function updateComponents() {
    // Restyle the parcels
    mapView.restyle();

    // Let the app know that the selection is ready.
    $.publish('selectionReady', [selection]);
  }

  function deselectParcels(removal) {
    if (removal) {
      _.each(removal, function (item) {
        item.feature.properties.selected = false;
      });
    }

    mapView.restyle();

    if (selection && selection.length > 0) {
      $.publish('selectionReady', [selection]);
    } else {
      // Nothing is selected anymore, so close and reset the form.
      formView.closeForm();
      formView.resetForm();
    }
  }

  function deselectAllParcels() {
    var removal;
    if (selection && !page.multi) {
      removal = [selection];
      selection = undefined;
    } else if (selection) {
      removal = selection;
      selection = [];
    }
    deselectParcels(removal);
  }

  function selectParcel(event) {
    // Clear the selection styling of the previous feature.
    if (!page.multi && selection) {
      selection.feature.properties.selected = false;
    }

    // Select the current layer
    var selectedFeature = event.target.feature;

    // If we've already selected this object, then remove it from the selection.
    if (page.multi) {
      var partitions = _.partition(selection, function (item) {
        return item.feature.id === selectedFeature.id;
      });

      var removal = partitions[0];
      selection = partitions[1];

      if (removal.length > 0) {
        deselectParcels(removal);
        return;
      }
    }

    selectedFeature.properties.selected = true;

    var selectedObject = {
      feature: selectedFeature,
      id: selectedFeature.id,
      // Store the human-readable name (often the address).
      humanReadableName: (selectedFeature.properties.address || // parcels endpoint
                          selectedFeature.properties.shortName) // features endpoint
    };

    if (!selectedObject.humanReadableName) {
      selectedObject.humanReadableName = 'Unknown Location';
    }

    // Store the centroid.
    if (selectedFeature.properties.centroid !== undefined) {
      selectedObject.centroid = selectedFeature.properties.centroid;
    } else {
      selectedObject.centroid = {
        type: 'Point',
        coordinates: computeCentroid(selectedFeature.geometry)
      };
    }

    // If the base feature has other info properties, store those.
    if (selectedFeature.properties.info !== undefined) {
      selectedObject.info = selectedFeature.properties.info;
    }

    selectedObject.geometry = selectedFeature.geometry;

    // If there is an address associated with the selected object, save that.
    // TODO: For now, if the survey type is "address", we assume the object
    // name indicates the address.
    // TODO: This is Houston-specific for beta testing.
    if (settings.survey.type === 'address') {
      var address = selectedFeature.properties.address;
      var city = 'houston';
      if (address.length > city.length && address.substr(address.length - city.length).toLocaleLowerCase() === city) {
        selectedObject.address = address.substr(0, address.length - city.length - 1).titleCase();
      }
    }

    // Now that we definitely know the centroid coordinates, let the mapView
    // react visually.
    mapView.objectSelected(selectedObject, true);

    if (page.multi) {
      selection.push(selectedObject);
    } else {
      selection = selectedObject;
    }

    updateComponents();
  }

  function selectPoint(lnglat, scroll) {
    // Keep track of the selected location
    var selectedObject = {
      id: '',
      humanReadableName: 'Custom location',
      centroid: {
        type: 'Point',
        coordinates: lnglat
      },
      geometry: {
        type: 'Point',
        coordinates: lnglat
      }
    };

    // Try to find a better name for the location.
    api.reverseGeocode(lnglat[0], lnglat[1], function (error, location) {
      if (error) {
        console.error(error);
      }

      if (location) {
        selectedObject.humanReadableName = 'Near ' + location.shortName;
      }

      // Let the app know that we've selected something.
      mapView.objectSelected(selectedObject, scroll);

      // Let the app know that the selection is ready.
      $.publish('selectionReady', [selectedObject]);
    });
  }

  function selectAddress(address) {
    api.geocodeAddress(address, function (error, data) {
      if (error) {
        if (error.type === 'GeocodingError') {
          console.warn('We could not geocode the address: '  + address);
        } else {
          console.error('Unexpected error of type ' + error.type);
          console.error(error.message);
        }
        settings.address = '';
        return;
      }

      mapView.goToLocation(data.coords, { zoom: 17 });

      var selectedObject = {
        id: '',
        humanReadableName: address,
        centroid: {
          type: 'Point',
          coordinates: data.coords
        },
        geometry: {
          type: 'Point',
          coordinates: data.coords
        }
      };

      $.publish('selectionReady', [selectedObject]);
    });
  }

  var $addressSearchStatus = $('#address-search-status');

  function findAddress(address, done) {
    $addressSearchStatus.html('Searching for the address');
    $addressSearchStatus.fadeIn(200);

    api.geocodeAddress(address, function (error, data) {
      $addressSearchStatus.fadeOut(100);

      if (error) {
        if (error.type === 'GeocodingError') {
          console.warn('We could not geocode the address: '  + address);
        } else {
          console.error('Unexpected error of type ' + error.type);
          console.error(error.message);
        }
        settings.address = '';
        $addressSearchStatus.html('Sorry, we weren\'t able to find that address');
        $addressSearchStatus.fadeIn(100).fadeOut(5000);
        return;
      }

      // Close the panel
      $toolPanel.panel('close');

      // Record the address, for potential later use by the survey questions.
      // TODO: Try to avoid storing this as central state.
      settings.address = data.addressLine;

      mapView.goToLocation(data.coords, { zoom: 19 });
    });
  }

  // Map tools ...............................................................

  // Handle searching for addresses
  var $addressInput = $('#address-input');
  $('#address-submit').click(function(){
    findAddress($addressInput.val());
  });

  $('#geolocate').click(function(){
    mapView.map.locate({
      setView: false,
      enableHighAccuracy: true
    });
  });

  $('#entry').click(function () {
    //app.selectedObject = {};

    // Indicate that we're ready for a form
    $.publish('readyForAddressForm');
  });

  var $multiselect = $('#multiselect-panel input:radio[name=multiselect]');
  var $multiselectOn = $('#multiselect-on');
  $multiselect.change(function () {
    var val = $multiselectOn.is(':checked');

    $toolPanel.panel('close');

    // We get change events from clicking the already-selected choice. In those
    // cases we have nothing to do.
    if (val === page.multi) {
      return;
    }

    page.multi = val;

    if (page.multi) {
      if (selection) {
        selection = [selection];
        updateComponents();
      } else {
        selection = [];
      }
    } else {
      if (selection) {
        // Deselect all but the last object.
        _.each(_.initial(selection), function (item) {
          item.feature.properties.selected = false;
        });
        selection = _.last(selection);
      }

      if (selection) {
        updateComponents();
      }
    }
  });


  page.init = function init(options) {
    var mapInitialization = mapView.init(options.mapContainer.prop('id'));
    formView.init(options.form);

    $.subscribe('map:objectSelected', function (__, e) {
      selectParcel(e);
    });

    $.subscribe('map:pointSelected', function (__, coords, scroll) {
      selectPoint(coords, scroll);
    });

    $.subscribe('map:enteringParcelMode', function () {
      deselectAllParcels();
      $('#multiselect-panel').show();
    });

    $.subscribe('map:leavingParcelMode', function () {
      $('#multiselect-panel').hide();
      deselectAllParcels();
    });

    $.subscribe('submitting', function () {
      // Mark the objects as pending, rather than selected.
      if (page.multi) {
        _.each(selection, function (item) {
          item.feature.properties.selected = false;
          item.feature.properties.pending = true;
        });
        selection = [];
      } else if (selection) {
        selection.feature.properties.selected = false;
        selection.feature.properties.pending = true;
        selection = null;
      }
      mapView.restyle();
    });

    // Tell the map to go into parcel, point, address-point, or pointandparcel mode.
    if (settings.survey.type === 'parcel') {
      $('#multiselect-panel').show();

    } else if (settings.survey.type === 'point') {
      mapInitialization.then(function () {
        mapView.showPointInterface();
      });

    } else if (settings.survey.type === 'pointandparcel') {
      $('#pointparcelswitch').show();
      $('#multiselect-panel').show();

      // Set a custom name for object selection (eg "sidewalk mode")
      if (settings.survey.surveyOptions && settings.survey.surveyOptions.objectType) {
        $('#parcel-mode-switch').html(settings.survey.surveyOptions.objectType + ' mode');
      }

      $('#radio-choice-point').click(function() {
        mapView.showPointInterface();
        var $start = $('#startpoint');
        $start.find('h2').html('Welcome, ' + settings.collectorName + '<br>Pan and add a point to begin');
        $start.show();
      });
      $('#radio-choice-parcel').click(function() {
        mapView.hidePointInterface();
        var $start = $('#startpoint');

        // Use a custom prompt, if any
        if (settings.survey.surveyOptions && settings.survey.surveyOptions.prompt) {
          $start.find('h2').html('Welcome, ' + settings.collectorName + '<br>' + settings.survey.surveyOptions.prompt);
        } else {
          $start.find('h2').html('Welcome, ' + settings.collectorName + '<br>Tap a parcel to begin');
        }
        $start.show();
      });

    } else if (settings.survey.type === 'address-point') {
      mapView.setupAddressPointSurvey();

      // In address-point mode, we react to a special address input field on
      // the form and show the corresponding location on the map. That point
      // becomes the geographic selection.
      $.subscribe('mapAddress', function (e, address) {
        selectAddress(address);
      });
    }
  };

  return page;
});
