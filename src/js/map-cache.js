/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var settings = require('settings');
  var _ = require('lib/underscore');
  var $ = require('jquery');
  var L = require('lib/leaflet');
  var Lawnchair = require('lawnchair');

  var mc = {};

  // Local storage for map tiles.
  var mapDB = null;

  // Initialize the cached-map module.
  // Set up the local database.
  // @param {Function} done Called with null if initialization went smoothly.
  mc.init = function init(done) {
    var lawnchair = new Lawnchair({ name: 'mapDB' }, function (db) {
      mapDB = db;
      mc.initMetadata(function () {
        done(null);
      });
    });
  };

  mc.bingOptions = {
		subdomains: [0, 1, 2, 3],
		type: 'Aerial',
		attribution: 'Bing'
  };

  mc.initMetadata = function initMetadata(done) {
    $.ajax({
		  url: '//dev.virtualearth.net/REST/v1/Imagery/Metadata/' + mc.bingOptions.type + '?include=ImageryProviders&key=' + settings.bing_key,
      jsonp: 'jsonp',
      dataType: 'jsonp'
    }).done(function (data) {
      var r = data.resourceSets[0].resources[0];
      mc.bingOptions.subdomains = r.imageUrlSubdomains;
      mc.bingOptions.url = r.imageUrl;

      var providers = [];
      var i;
      var j;
      for (i = 0; i < r.imageryProviders.length; i += 1) {
        var p = r.imageryProviders[i];
        for (j = 0; j < p.coverageAreas.length; j += 1) {
          var c = p.coverageAreas[j];
          var coverage = {zoomMin: c.zoomMin, zoomMax: c.zoomMax, active: false};
          var bounds = new L.LatLngBounds(
              new L.LatLng(c.bbox[0]+0.01, c.bbox[1]+0.01),
              new L.LatLng(c.bbox[2]-0.01, c.bbox[3]-0.01)
          );
          coverage.bounds = bounds;
          coverage.attrib = p.attribution;
          providers.push(coverage);
        }
      }

      mc.bingOptions.providers = providers;

      done();
    }).fail(function () {
      done(new Error('failed to get base layer metadata'));
    });
  };

  mc.layer = L.tileLayer.canvas({
    async: true
  });

  function onloading(e) {
    function updateAttribution(event) {
      var map = event.target;
      var bounds = map.getBounds();
      var zoom = map.getZoom();
      var providers = mc.bingOptions.providers;
      var i;
      for (i = 0; i < providers.length; i += 1) {
        var p = providers[i];
        if ((zoom <= p.zoomMax && zoom >= p.zoomMin) &&
            bounds.intersects(p.bounds)) {
          if (!p.active) {
            map.attributionControl.addAttribution(p.attrib);
          }
          p.active = true;
        } else {
          if (p.active) {
            map.attributionControl.removeAttribution(p.attrib);
          }
          p.active = false;
        }
      }
    }

    e.target._map.on('moveend', updateAttribution);

    mc.layer.off('loading', onloading);
  }
  mc.layer.on('loading', onloading);

	function tile2quad(x, y, z) {
		var quad = '';
		for (var i = z; i > 0; i--) {
			var digit = 0;
			var mask = 1 << (i - 1);
			if ((x & mask) != 0) digit += 1;
			if ((y & mask) != 0) digit += 2;
			quad = quad + digit;
		}
		return quad;
	}

  mc.layer.drawTile = function drawTile(canvas, p, z) {
		var subdomains = mc.bingOptions.subdomains;
    var s = subdomains[(p.x + p.y) % subdomains.length];
    if (z === undefined) {
      z = this._map.getZoom();
    }
		var url = mc.bingOptions.url.replace('{subdomain}', s)
				.replace('{quadkey}', tile2quad(p.x, p.y, z))
				.replace('{culture}', '');

    var context = canvas.getContext('2d');

    mapDB.get(url, function (doc) {
      var image = new Image();

      if (doc) {
        image.onload = function () {
          context.drawImage(this, 0, 0);
          mc.layer.tileDrawn(canvas);
        };
        image.src = doc.uri;

        return;
      }

      // No cached tile. Fetch it from the remote source.
      image.onload = function () {
        context.drawImage(this, 0, 0);
        mc.layer.tileDrawn(canvas);

        // Cache the tile
        var dataURI = canvas.toDataURL();
        mapDB.save({ key: url, uri: dataURI });
      };

      // Get the image data as a base64-encoded Data URI
      $.ajax({
        url: '//data-uri.herokuapp.com/convert?url=' + encodeURIComponent(url)
      }).done(function (data) {
        image.src = data.uri;
      });
    });
  };


  return mc;
});
