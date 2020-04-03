var AWS = require('aws-sdk');
var glob = require('glob');
var path = require('path');
var fs = require('fs');
var async = require('async');
var mimeTypes = require('mime-types');
var shelljs = require('shelljs');

function getEnvVariable(name) {
  return process.env[name] || fs.readFileSync(path.join(process.env.ENV_DIR, name), {encoding: 'utf8'});
}

var region = getEnvVariable('AWS_DEFAULT_REGION');
try {

  // AWS.config.logger = process.stdout;
  AWS.config.maxRetries = 10;

  AWS.config.accessKeyId = getEnvVariable('AWS_ACCESS_KEY_ID');
  AWS.config.secretAccessKey = getEnvVariable('AWS_SECRET_ACCESS_KEY');
  AWS.config.region = region;

  // bucket where static assets are uploaded to
  var AWS_STATIC_BUCKET_NAME = getEnvVariable('AWS_STATIC_BUCKET_NAME');
  // the source directory of static assets
  var AWS_STATIC_SOURCE_DIRECTORY = getEnvVariable('AWS_STATIC_SOURCE_DIRECTORY');
  // the prefix assigned to the path, can be used to configure routing rules in CDNs
  var AWS_STATIC_PREFIX = getEnvVariable('AWS_STATIC_PREFIX');

} catch(error) {
  console.error('Static Uploader is not configured for this deploy');
  console.error(error);
  console.error('Exiting without error');
  process.exit(0);
}

// the sha-1 or version supplied by heroku used to version builds in the path
var SOURCE_VERSION = (process.env.SOURCE_VERSION || '').slice(0, 7);
var BUILD_DIR = process.env.BUILD_DIR;

// location of public assets in the heroku build environment
var PUBLIC_ASSETS_SOURCE_DIRECTORY = path.join(BUILD_DIR, AWS_STATIC_SOURCE_DIRECTORY);


var destinationFolderType = getEnvVariable('AWS_STATIC_DESTINATION_TYPE');

var STATIC_PATH;
if (destinationFolderType === 'STATIC_ROOT') {
  STATIC_PATH = AWS_STATIC_PREFIX;
} else {
  // uploaded files are prefixed with this to enable versioning
  STATIC_PATH = path.join(
    AWS_STATIC_PREFIX,
    new Date().toISOString().split("T")[0],
    SOURCE_VERSION
  );
}

console.log(
  'Uploading to folder "' + STATIC_PATH + '" in bucket ' +
  AWS_STATIC_BUCKET_NAME + ' in region ' + region
)

glob(PUBLIC_ASSETS_SOURCE_DIRECTORY + '/**/*.*', {}, function(error, files) {

    if (error || !files) {
      return process.exit(1);
    }

    console.log('Files to Upload:', files.length);
    console.time('Upload Complete In');

    var yearInMs = 365 * 24 * 60 * 60000;
    var yearFromNow = Date.now() + yearInMs;

    var s3 = new AWS.S3();
    async.eachLimit(files, 16, function(file, callback) {

        var stat = fs.statSync(file);
        if (!stat.isFile()) {
          console.log('Not a file', file);
          return callback(null);
        }

        var contentType = mimeTypes.lookup(path.extname(file)) || null;
        if (!contentType) {
          console.warn('Unknown ContentType:', contentType, file);
          contentType = 'application/octet-stream';
        }

        s3.upload({
          ACL: 'public-read',
          Key: path.join(STATIC_PATH, file.replace(PUBLIC_ASSETS_SOURCE_DIRECTORY, '')),
          Body: fs.createReadStream(file),
          Bucket: AWS_STATIC_BUCKET_NAME,
          Expires: new Date(yearFromNow),
          CacheControl: 'public,max-age=' + yearInMs + ',smax-age=' + yearInMs,
          ContentType: contentType
        }, callback)

      },
      function onUploadComplete(error) {
        console.timeEnd('Upload Complete In');

        if (error) {
          console.error('Static Uploader failed to upload to S3');
          console.error(error);
          console.error('ASSETS_PREFIX ENV variable will not be set, and assets will be served from Heroku.');
          process.exit(0);
        }

        var profiled = process.env.BUILD_DIR + '/.profile.d';
        var content = (
          'echo EXPORTING STATIC ENV VARIABLES\n' +
          'export ASSETS_PREFIX=${ASSETS_PREFIX:-https://' + AWS_STATIC_BUCKET_NAME + '.s3-' + region + '.amazonaws.com/' + STATIC_PATH + '}\n'
        );
        console.log('Writing ' + content + ' to profile.d');
        fs.writeFileSync(
          path.join(profiled, '00-upload-static-files-to-s3-export-env.sh'), content, {encoding: 'utf8'}
        );
        console.log('Done');

        process.exit(0);
      });
  }
);

