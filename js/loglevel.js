/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var log = console.log;
  var info = console.info;
  var warn = console.warn;
  var error = console.error;
  function noop() {}

  return function logLevel(level) {
    if (level === 'info' || level === 'all' || level === 'verbose') {
      // Log everything
      console.log = log;
      console.info = info;
      console.warn = warn;
      console.error = error;
    } else if (level === 'warn') {
      // Log warnings and errors
      console.log = noop;
      console.info = noop;
      console.warn = warn;
      console.error = error;
    } else if (level === 'error') {
      // Only log errors
      console.log = noop;
      console.info = noop;
      console.warn = noop;
      console.error = error;
    } else if (level === 'silent') {
      // Hush! Don't log to console
      console.log = noop;
      console.info = noop;
      console.warn = noop;
      console.error = noop;
    } else {
      warn.call(console, 'Called with an unsupported level: ' + level);
    }
  };
});
