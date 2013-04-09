/*jslint nomen: true */
/*globals require: true */

(function () {
  'use strict';
  /*
   * Trim function: strips whitespace from a string. 
   * Use: " dog".trim() === "dog" //true
   */
  if(typeof(String.prototype.trim) === "undefined") {
    String.prototype.trim = function() {
      return String(this).replace(/^\s+|\s+$/g, '');
    };
  }

  if(typeof(String.prototype.titleCase) === "undefined") {
    String.prototype.titleCase = function() { 
      return this.toLowerCase().replace(/^.|\s\S/g, function(a) { return a.toUpperCase(); });
    };
  }
}());

require.config({
  paths: {
    jquery: 'lib/jquery',
    'lib/leaflet': 'lib/leaflet/leaflet'
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

require(['jquery', 'app', 'lib/jquery.mobile', 'lib/jquery.cookie', 'lib/jquery.tinypubsub', 'lib/jquery.exif', 'lib/jquery.canvasResize', 'lib/leaflet', 'lib/tilelayer.bing.pull', 'loglevel'],
        function ($, app, jqm, jqc, jqtps, jqexif, canvasResize, L, tLBing, logLevel) {
  'use strict';

  logLevel('verbose');
  $(document).ready(function () {
    app.init();
  });
});

