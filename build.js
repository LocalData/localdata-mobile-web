({
  name: 'main',
  paths: { 
    jquery: 'empty:',
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
  },
  baseUrl: 'js',
  out: '/tmp/main-built.js'
})
