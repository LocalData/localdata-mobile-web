/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var settings = require('settings');
  var _ = require('lib/underscore');
  var $ = require('jquery');

  var appCache = window.applicationCache;

  var manager = {};

  // Set up the App Cache logic.
  // This only handles updates to a cached app.
  // If we have updates, we need to reload the page for the updates to take hold.
  //
  // If there are no updates, we
  //
  // If we are loading the cache for the first time, this also provides UI
  // to track progress so the user sees what's going on.
  //
  // @param {Function} done Called when we've determined that there are no
  // updates. Takes no arguments.
  manager.init = function init(done) {
    console.log('Initializing app cache manager');

    if (!appCache) {
      console.log('This platform has no application cache');
      return done();
    }

    /**
     * Reload the page if we have a new cache.
     * @param  {Object} e Event (not used)
     */
    function handleUpdate(e) {
     if (appCache.status === window.applicationCache.UPDATEREADY) {
        // We got a new app cache.
        // Swap in the new cache and reload the page, so we're using the new
        // code.
        window.applicationCache.swapCache();

        // Propmpt the user to reload the app to load the new version
        // If they don't reload it right away, it'll update the next time they
        // load the app anyways.
        $('.update-prompt').show();
        console.log($('.update-prompt'), $('.update-prompt .close'));
        $('.update-prompt .reload').click(function() {
          window.location.reload();
        });
        $('.update-prompt .close').click(function(e) {
          console.log("Close the prompt");
          e.preventDefault();
          $('.update-prompt').hide();
        });

      } else {
        // If the manifest didn't change, we can proceed with the rest of the app.
        done();
      }
    }

    // New versions of the manifest resources have been downloaded.
    appCache.addEventListener('updateready', handleUpdate, false);
  };

  return manager;
});
