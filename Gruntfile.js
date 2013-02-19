var exec = require('child_process').exec;

module.exports = function(grunt) {
  'use strict';

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Read local settings for things like the deployment locations
    // The format should be:
    // {
    //   "deploy" : {
    //     "default" : "s3://awesomebucket/folder/subfolder/",
    //     "bob" : "s3://awesomebucket/folder/subfolder/",
    //     "staging" : "s3://seriousbucket/staging/app/",
    //     "production : "s3://seriousbucket/production/app/"
    //   }
    // }
    dev: (function () {
      var settings = 'dev-settings.json';
      if (grunt.file.isFile(settings)) {
        return grunt.file.readJSON('dev-settings.json');
      }
      return {};
    }()),

    dirs: {
      staging: 'temp',
      build: 'build'
    },

    clean: ['<%= dirs.staging %>', '<%= dirs.build %>'],

    requirejs: {
      compile: {
        options: {
          name: 'main',
          baseUrl: 'src/js',
          mainConfigFile: 'src/js/main.js',
          out: '<%= dirs.staging %>/js/main.js',
          optimize: 'uglify2',
          uglify2: {
            // Preserve license/copyright comments
            preserveComments: ( function () {
              var re = /\(c\)|copyright|license/gi;
              return function checkComments(node, token) {
                return re.test(token.value);
              };
            }())
          }
        }
      }
    },

    cssmin: {
      compress: {
        files: [ {
          expand: true,     // Enable dynamic expansion.
          cwd: 'src/',      // Src matches are relative to this path.
          src: ['**/*.css'], // Actual pattern(s) to match.
          dest: '<%= dirs.staging %>'   // Destination path prefix.
        } ]
      }
    },

    copy: {
      staging: {
        files: [
          // TODO: combine main.js and require.js
          {
            expand: true,
            cwd: 'src/',
            src: [
              'js/require.js',
              '*.html',
              'img/**',
              '**/*.png' // Leaflet looks for PNGs in a funny spot
            ],
            dest: '<%= dirs.staging %>'
          }
        ]
      },
      build: {
        files: [
          {
            expand: true,
            cwd: '<%= dirs.staging %>',
            src: [
              'js/require.js',
              'js/main.js',
              '**/*.css',
              'css/**',
              '*.html',
              'img/**',
              '**/*.png'
            ],
            dest: '<%= dirs.build %>'
          }
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-requirejs');

  grunt.registerTask('deploy', 'Deploy the build directory to S3 using s3cmd', function (locname) {
    var deploy = grunt.config('dev').deploy;
    var location;

    // Use the 'default' config value if we didn't specify a specific destination.
    if (locname === undefined) {
      location = deploy['default'];
    } else {
      location = deploy[locname];
    }

    if (location === undefined) {
      grunt.log.error('No destination configured by that name: ' + locname);
      return false;
    }

    var done = this.async();
    var src = grunt.config('dirs').build;

    // Make sure the source path ends with a slash.
    if (src[src.length - 1] !== '/') {
      src = src + '/';
    }

    // Make sure the destination path ends with a slash.
    if (location[location.length - 1] !== '/') {
      location = location + '/';
    }

    var cmd = 's3cmd sync ' + src + ' ' + location;
    exec(cmd, function (error, stdout, stderr) {
      if (stdout.length > 0) {
        grunt.log.writeln(stdout);
      }

      if (stderr.length > 0) {
        grunt.log.error(stderr);
      }

      if (error) {
        done(false);
      }

      done();
    });
  });

  grunt.registerTask('build', ['cssmin', 'requirejs', 'copy:staging', 'copy:build']);
  

  // Default task
  grunt.registerTask('default', ['build']);

};
