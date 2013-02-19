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
    jquery: 'http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery',
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

require(['jquery', 'app', 'lib/jquery.mobile', 'lib/jquery.cookie', 'lib/jquery.tinypubsub', 'lib/leaflet', 'lib/tilelayer.bing.pull'],
        function ($, app, jqm, jqc, jqtps, L, tLBing) {
  'use strict';

  $(document).ready(function () {
    app.init();
  });
});
    
