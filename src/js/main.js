/*jslint nomen: true */
/*globals require: true */

(function () {
  'use strict';
  /*
   * Trim function: strips whitespace from a string.
   * Use: " dog".trim() === "dog" //true
   */
  if(String.prototype.trim === undefined) {
    String.prototype.trim = function() {
      return String(this).replace(/^\s+|\s+$/g, '');
    };
  }

  if(String.prototype.titleCase === undefined) {
    String.prototype.titleCase = function() {
      return this.toLowerCase().replace(/^.|\s\S/g, function(a) { return a.toUpperCase(); });
    };
  }
}());

require.config({
  paths: {
    jquery: 'lib/jquery',
    'lib/leaflet': 'lib/leaflet/leaflet',
    lawnchair: 'lib/lawnchair'
  },
  shim: {
    'lib/underscore': {
      exports: '_'
    },
    'lib/leaflet': {
      exports: 'L'
    },
    'lib/tilelayer.bing.pull': ['lib/leaflet']
  }
});

require(['jquery', 'app', 'lib/jquery.mobile', 'lib/jquery.cookie',
        'lib/jquery.tinypubsub', 'lib/jquery.canvasResize', 'lib/leaflet', 'lib/tilelayer.bing.pull',
        'loglevel', 'lawnchair', 'lib/lawnchair-adapter-indexed-db', 'lib/lawnchair-adapter-webkit-sqlite'],
        function ($, app, jqm, jqc,
                  jqtps, canvasResize, L, tLBing,
                  logLevel, lawnchair, adapterIDB, adapterWebSQL) {
  'use strict';

  logLevel('verbose'); // silent or verbose
  // $(document).trigger('mobileinit');
  $(document).ready(function() {
    app.init();
  });
});

