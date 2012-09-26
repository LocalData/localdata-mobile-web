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
    jquery: 'lib/jquery'
  },
  shim: {
    'lib/underscore': {
      exports: '_'
    },
    'jquery.mobile': ['jquery'],
    'jquery.cookie': ['jquery'],
    'jquery.tinypubsub': ['jquery']
  }
});

require(['jquery', 'app', 'lib/jquery.mobile', 'lib/jquery.cookie', 'lib/jquery.tinypubsub'],
        function ($, app, jqm, jqc, jqtps) {
  'use strict';

  $(document).ready(function () {
    app.init();
  });
});
    
