# [LocalData](http://localdata.com)

We make it easy for cities, nonprofits, neighborhood organizations and others to collect good information about the things they care about, like property condition, vacancy, points of interest, and more. Read more at [localdata.com](http://localdata.com)

This mobile data collection app is part of the greater LocalData toolkit.

## Running the app

The app is static HTML pages + javascript. It does assume that it's being served by the same host as the [LocalData API](https://github.com/LocalData/localdata-api)

## Building/deploying

We use Grunt to prepare the app for deployment. Run `grunt` or `grunt build` to build the minified, deployable package. You can configure locations in a `dev-settings.json` file, after which `grunt deploy` or `grunt deploy:mylocation` will sync the built package to an S3 location. Deployment requires [s3cmd](http://s3tools.org/s3cmd)

Sample `dev-settings.json`:

    {
      "deploy" : {
        "default" : "s3://mybucket/web/my-mobile-dev/",
        "dev" : "s3://mybucket/web/my-mobile-dev/",
        "production" : "s3://mybucket/production-web/mobile"
      }
    }

## Nightwatch tests

We use [Nightwatch.js](http://nightwatchjs.org/) with [Selenium](http://docs.seleniumhq.org/) for automated browser testing.

### Setup

Run `npm install` to install dependencies, including Nightwatch.

Download and copy the most recent [Selenium](http://docs.seleniumhq.org/) jar to
`test/selenium-server-standalone.jar`.

### Running

You'll need the LocalData server running on port 3443 with a survey named
"test" available.

From the tests directory, run `./nightwatch` to run the tests.


