
var LambdaForwarder = require("aws-lambda-ses-forwarder");

exports.handler = function(event, context, callback) {
  // See aws-lambda-ses-forwarder/index.js for all options.
  var overrides = {
    config: {
      fromEmail: "noreply@example.com",
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
  LambdaForwarder.handler(event, context, callback, overrides);
};
