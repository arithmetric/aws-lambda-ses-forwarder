
var LambdaForwarder = require("aws-lambda-ses-forwarder");

exports.handler = function(event, context) {
  // Configure the S3 bucket and key prefix for stored raw emails, and the
  // mapping of email addresses to forward from and to.
  //
  // Expected keys/values:
  // - emailBucket: S3 bucket name where SES stores emails.
  // - emailKeyPrefix: S3 key name prefix where SES stores email. Include the
  //   trailing slash.
  // - forwardMapping: Object where the key is the email address from which to
  //   forward and the value is an array of email addresses to which to send the
  //   message.
  var overrides = {
    config: {
      emailBucket: "s3-bucket-name",
      emailKeyPrefix: "emailsPrefix/",
      forwardMapping: {
        "info@example.com": [
          "example.john@example.com",
          "example.jen@example.com"
        ],
        "abuse@example.com": [
          "example.jim@example.com"
        ]
      }
    }
  };
  LambdaForwarder.handler(event, context, overrides);
};
