console.log("AWS Lambda SES Forwarder // @arithmetric // Version 2.0.0");

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
var defaultConfig = {
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
};

/**
 * Parses the SES event record provided for the `mail` and `receipients` data.
 *
 * @param {object} data - Data bundle with context, email, etc.
 * @param {function} next - Callback function invoked as (error, data).
 */
exports.parseEvent = function(data, next) {
  // Validate characteristics of a SES event record.
  if (!data.event ||
      !data.event.hasOwnProperty('Records') ||
      data.event.Records.length !== 1 ||
      !data.event.Records[0].hasOwnProperty('eventSource') ||
      data.event.Records[0].eventSource !== 'aws:ses' ||
      data.event.Records[0].eventVersion !== '1.0') {
    console.log("parseEvent() received invalid SES message:",
      JSON.stringify(data.event));
    data.context.fail('Error: Received invalid SES message.');
    return;
  }

  data.email = data.event.Records[0].ses.mail;
  data.recipients = data.event.Records[0].ses.receipt.recipients;
  next(null, data);
};

/**
 * Transforms the original recipients to the desired forwarded destinations.
 *
 * @param {object} data - Data bundle with context, email, etc.
 * @param {function} next - Callback function invoked as (error, data).
 */
exports.transformRecipients = function(data, next) {
  var newRecipients = [];
  data.originalRecipients = data.recipients;
  data.recipients.forEach(function(origEmail) {
    if (data.config.forwardMapping.hasOwnProperty(origEmail)) {
      newRecipients = newRecipients.concat(
        data.config.forwardMapping[origEmail]);
      data.originalRecipient = origEmail;
    }
  });

  if (!newRecipients.length) {
    data.context.fail("Error: No new recipients found after mapping for " +
      "original destinations: " + data.originalRecipients.join(", "));
    return;
  }

  data.recipients = newRecipients;
  next(null, data);
};

/**
 * Fetches the message data from S3.
 *
 * @param {object} data - Data bundle with context, email, etc.
 * @param {function} next - Callback function invoked as (error, data).
 */
exports.fetchMessage = function(data, next) {
  // Copying email object to ensure read permission
  console.log('Fetching email at s3://' + data.config.emailBucket + '/' +
    data.config.emailKeyPrefix + data.email.messageId);
  data.s3.copyObject({
    Bucket: data.config.emailBucket,
    CopySource: data.config.emailBucket + '/' + data.config.emailKeyPrefix +
      data.email.messageId,
    Key: data.config.emailKeyPrefix + data.email.messageId,
    ACL: 'private',
    ContentType: 'text/plain',
    StorageClass: 'STANDARD'
  }, function(err) {
    if (err) {
      console.log("copyObject() returned error:", err, err.stack);
      return data.context.fail("Error: Could not make readable copy of email.");
    }

    // Load the raw email from S3
    data.s3.getObject({
      Bucket: data.config.emailBucket,
      Key: data.config.emailKeyPrefix + data.email.messageId
    }, function(err, result) {
      if (err) {
        console.log("getObject() returned error:", err, err.stack);
        return data.context.fail("Error: Failed to load message body from S3.");
      }
      data.emailData = result.toString();
      next(null, data);
    });
  });
};

/**
 * Processes the message data, making updates to recipients and other headers
 * before forwarding message.
 *
 * @param {object} data - Data bundle with context, email, etc.
 * @param {function} next - Callback function invoked as (error, data).
 */
exports.processMessage = function(data, next) {
  var match = data.emailData.match(/^((?:.+\r?\n)*)(\r?\n(?:.*\s+)*)/m);
  var header = match && match[1] ? match[1] : data.emailData;
  var body = match && match[2] ? match[2] : '';

  // SES does not allow sending messages from an unverified address,
  // so replace the message's "From:" header with the original
  // recipient (which is a verified domain) and replace any
  // "Reply-To:" header with the original sender.
  header = header.replace(/^Reply-To: (.*)\r?\n/mg, '');
  header = header.replace(
    /^From: (.*)/mg,
    function(match, from) {
      return 'From: ' + from.replace('<', '(').replace('>', ')') + ' via ' +
        data.recipients[0] + ' <' + data.recipients[0] + '>\n' +
        'Reply-To: ' + data.email.source;
    });

  // Remove the Return-Path header.
  header = header.replace(/^Return-Path: (.*)\r?\n/mg, '');

  // Remove DKIM-Signature headers that include "d=amazonses.com;" as the
  // presence of extra SES DKIM headers when sending the message triggers an
  // "InvalidParameterValue: Duplicate header 'DKIM-Signature'" error.
  header = header.replace(/^DKIM-Signature: (.*)\r?\n(\s+(.*)\r?\n)*/mg,
    function(match) {
      return match.indexOf("d=amazonses.com;") === -1 ? match : '';
    });

  data.emailData = header + body;
  next(null, data);
};

/**
 * Send email using the SES sendRawEmail command.
 *
 * @param {object} data - Data bundle with context, email, etc.
 * @param {function} next - Callback function invoked as (error, data).
 */
exports.sendMessage = function(data, next) {
  var params = {
    Destinations: data.recipients,
    Source: data.originalRecipient,
    RawMessage: {
      Data: data.emailData
    }
  };
  console.log("sendMessage: Sending email via SES. Original recipients: " +
    data.originalRecipients.join(", ") + ". Transformed recipients: " +
    data.recipients.join(", ") + ".");
  data.ses.sendRawEmail(params, function(err, result) {
    if (err) {
      console.log("sendRawEmail() returned error:", err, err.stack);
      data.context.fail('Error: Email sending failed.');
    } else {
      console.log("sendRawEmail() successful:", result);
      next(null, data);
    }
  });
};

/**
 * Report success after all steps are complete.
 *
 * @param {object} data - Data bundle with context.
 */
exports.finish = function(data) {
  data.context.succeed('Email sent successfully.');
};

/**
 * Handler function to be invoked by AWS Lambda with an inbound SES email as
 * the event.
 *
 * @param {object} event - Lambda event from inbound email received by AWS SES.
 * @param {object} context - Lambda context object.
 * @param {object} overrides - Overrides for the default data, including the
 * configuration, SES object, and S3 object.
 */
exports.handler = function(event, context, overrides) {
  var steps = [
    "parseEvent",
    "transformRecipients",
    "fetchMessage",
    "processMessage",
    "sendMessage",
    "finish"
  ];
  var step;
  var currentStep = 0;
  var AWS = require('aws-sdk');
  var data = {
    event: event,
    context: context,
    config: overrides && overrides.config ? overrides.config : defaultConfig,
    ses: overrides && overrides.ses ? overrides.ses : new AWS.SES(),
    s3: overrides && overrides.s3 ? overrides.s3 : new AWS.S3()
  };
  var nextStep = function(err, data) {
    if (!err && data && steps[currentStep] && exports[steps[currentStep]]) {
      step = exports[steps[currentStep]];
      currentStep++;
      step(data, nextStep);
    }
  };
  nextStep(null, data);
};
