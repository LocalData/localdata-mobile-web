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
  // Reload the page if we have an update. Otherwise, proceed once we've
  // determined there are no updates.
  // @param {Function} done Gets called when we've determined that there are no
  // updates. Takes no arguments.
  manager.init = function init(done) {
    console.log('Initializing app cache manager');

    var timeout = null;

    if (!appCache) {
      console.log('This platform has no application cache');
      return done();
    }

    function handleUpdate(e) {
      if (timeout !== null) {
        clearTimeout(timeout);
      }

      if (appCache.status === window.applicationCache.UPDATEREADY) {
        // We got a new app cache.
        // Swap in the new cache and reload the page, so we're using the new
        // code.
        window.applicationCache.swapCache();
        // TODO: we need to make sure this is not a jarring user experience.
        window.location.reload();
      } else {
        // If the manifest didn't change, we can proceed with the rest of the app.
        done();
      }
    }

    // Nothing to do. Proceed with current app code.
    function proceed(e) {
      if (timeout !== null) {
        clearTimeout(timeout);
      }

      console.info(e.type);
      console.log('Proceeding');
      done();
    }

    // If things are taking too long, skip the app cache stuff.
    timeout = setTimeout(function () {
      console.log('Timed out! Not using application cache.');
      // appCache.removeEventListener('updateready');
      // appCache.removeEventListener('error');
      // appCache.removeEventListener('noupdate');
      // appCache.removeEventListener('obsolete');
      // appCache.removeEventListener('cached');
      timeout = null;
      done();
    }, 1000);

    // New versions of the manifest resources have been downloaded.
    appCache.addEventListener('updateready', handleUpdate, false);

    // We encountered an error getting the manifest or one of the resources.
    appCache.addEventListener('error', proceed, false);

    // Manifest hasn't changed.
    appCache.addEventListener('noupdate', proceed, false);

    // Manifest no longer exists.
    appCache.addEventListener('obsolete', proceed, false);

    // Manifest resources have been downloaded and cached. This is not an
    // update of existing cached data.
    appCache.addEventListener('cached', proceed, false);
  };

  return manager;
});
