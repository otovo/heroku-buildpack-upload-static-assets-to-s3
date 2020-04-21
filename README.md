# Purpose

Uploads static assets to S3 when building Heroku apps.

Requires the NodeJS buildpack to be installed. `https://github.com/heroku/heroku-buildpack-nodejs`


# Setting Mandatory Environment Variables for Build

```
AWS_ACCESS_KEY_ID=<aws access key id>
AWS_SECRET_ACCESS_KEY=<aws secret access key>
AWS_DEFAULT_REGION=<aws-region>
AWS_STATIC_BUCKET_NAME=<s3-bucket-name>
# prefix to include in path
AWS_STATIC_PREFIX=static
# The directory to upload to S3 (uploads the content of the directory)
AWS_STATIC_SOURCE_DIRECTORY=public
```

Assets are uploaded to sub-folders with the current date on S3. If you rather
want files to be uploaded directly to the static root folder, set
`AWS_STATIC_DESTINATION_TYPE=STATIC_ROOT`.
