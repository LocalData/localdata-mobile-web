# Wax

Tools for improving web maps. The centerpiece of the code is a client implementation of the [MBTiles interaction specification](https://github.com/mapbox/mbtiles-spec).

For full documentation of supported mapping APIs and how to use Wax see http://mapbox.github.com/wax.

## Compatibility

* Google Maps API v3
* Leaflet 0.x.x
* Modest Maps 0.x.x
* OpenLayers 2.11

Versions of OpenLayers besides 2.11 are **not supported**.

## Building Wax

For end users, a minified library is already provided in `dist/`.

But for developers you can rebuild a minified library by running:

    npm install --dev
    make

## Includes

Wax currently includes three externals:

* [reqwest](https://github.com/ded/reqwest) (MIT)
* [mustache.js](https://github.com/janl/mustache.js) (MIT)
* [html-sanitizer from Google Caja](http://code.google.com/p/google-caja/source/browse/trunk/src/com/google/caja/plugin/html-sanitizer.js) (Apache)

## Authors

- Tom MacWright (tmcw)
- Young Hahn (yhahn)
- Will White (willwhite)
