"use strict";

var AWS = require('aws-sdk');

console.log("AWS Lambda SES Forwarder // @arithmetric // Version 3.0.0");

// Configure the S3 bucket and key prefix for stored raw emails, and the
// mapping of email addresses to forward from and to.
//
// Expected keys/values:
// - fromEmail: Forwarded emails will come from this verified address
// - emailBucket: S3 bucket name where SES stores emails.
// - emailKeyPrefix: S3 key name prefix where SES stores email. Include the
//   trailing slash.
// - forwardMapping: Object where the key is the email address from which to
//   forward and the value is an array of email addresses to which to send the
//   message. To match all email addresses on a domain, use a key without the
//   name part of an email address before the "at" symbol (i.e. `@example.com`).
//   The key must be lowercase.
var defaultConfig = {
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
    ],
    "@example.com": [
      "example.john@example.com"
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
    data.log({message: "parseEvent() received invalid SES message:",
      level: "error", event: JSON.stringify(data.event)});
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
    var origEmailKey = origEmail.toLowerCase();
    if (data.config.forwardMapping.hasOwnProperty(origEmailKey)) {
      newRecipients = newRecipients.concat(
        data.config.forwardMapping[origEmailKey]);
      data.originalRecipient = origEmail;
    } else {
      var origEmailDomain;
      var pos = origEmailKey.lastIndexOf("@");
      if (pos !== -1) {
        origEmailDomain = origEmailKey.slice(pos);
      }
      if (origEmailDomain &&
          data.config.forwardMapping.hasOwnProperty(origEmailDomain)) {
        newRecipients = newRecipients.concat(
          data.config.forwardMapping[origEmailDomain]);
        data.originalRecipient = origEmail;
      }
    }
  });

  if (!newRecipients.length) {
    data.log({message: "Finishing process. No new recipients found for " +
      "original destinations: " + data.originalRecipients.join(", "),
      level: "info"});
    data.context.succeed();
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
  data.log({level: "info", message: "Fetching email at s3://" +
    data.config.emailBucket + '/' + data.config.emailKeyPrefix +
    data.email.messageId});
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
      data.log({level: "error", message: "copyObject() returned error:",
        error: err, stack: err.stack});
      return data.context.fail("Error: Could not make readable copy of email.");
    }

    // Load the raw email from S3
    data.s3.getObject({
      Bucket: data.config.emailBucket,
      Key: data.config.emailKeyPrefix + data.email.messageId
    }, function(err, result) {
      if (err) {
        data.log({level: "error", message: "getObject() returned error:",
          error: err, stack: err.stack});
        return data.context.fail("Error: Failed to load message body from S3.");
      }
      data.emailData = result.Body.toString();
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

  // Add "Reply-To:" with the "From" address if it doesn't already exists
  if (!/^Reply-To: /m.test(header)) {
    match = header.match(/^From: (.*\r?\n)/m);
    var from = match && match[1] ? match[1] : '';
    if (from) {
      header = header + 'Reply-To: ' + from;
      data.log({level: "info", message: "Added Reply-To address of: " + from});
    } else {
      data.log({level: "info", message: "Reply-To address not added because " +
       "From address was not properly extracted."});
    }
  }

  // SES does not allow sending messages from an unverified address,
  // so replace the message's "From:" header with the original
  // recipient (which is a verified domain)
  header = header.replace(
    /^From: (.*)/mg,
    function(match, from) {
      var fromText;
      if (data.config.fromEmail) {
        fromText = 'From: ' + from.replace(/<(.*)>/, '').trim() +
        ' <' + data.config.fromEmail + '>';
      } else {
        fromText = 'From: ' + from.replace('<', 'at ').replace('>', '') +
        ' <' + data.originalRecipient + '>';
      }
      return fromText;
    });

  // Remove the Return-Path header.
  header = header.replace(/^Return-Path: (.*)\r?\n/mg, '');

  // Remove Sender header.
  header = header.replace(/^Sender: (.*)\r?\n/mg, '');

  // Remove all DKIM-Signature headers to prevent triggering an
  // "InvalidParameterValue: Duplicate header 'DKIM-Signature'" error.
  // These signatures will likely be invalid anyways, since the From
  // header was modified.
  header = header.replace(/^DKIM-Signature: .*\r?\n(\s+.*\r?\n)*/mg, '');

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
  data.log({level: "info", message: "sendMessage: Sending email via SES. " +
    "Original recipients: " + data.originalRecipients.join(", ") +
    ". Transformed recipients: " + data.recipients.join(", ") + "."});
  data.ses.sendRawEmail(params, function(err, result) {
    if (err) {
      data.log({level: "error", message: "sendRawEmail() returned error.",
        error: err, stack: err.stack});
      data.context.fail('Error: Email sending failed.');
    } else {
      data.log({level: "info", message: "sendRawEmail() successful.",
        result: result});
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
  data.log({level: "info", message: "Process finished successfully."});
  data.context.succeed();
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
  var steps = overrides && overrides.steps ? overrides.steps :
  [
    exports.parseEvent,
    exports.transformRecipients,
    exports.fetchMessage,
    exports.processMessage,
    exports.sendMessage
  ];
  var step;
  var currentStep = 0;
  var data = {
    event: event,
    context: context,
    config: overrides && overrides.config ? overrides.config : defaultConfig,
    log: overrides && overrides.log ? overrides.log : console.log,
    ses: overrides && overrides.ses ? overrides.ses : new AWS.SES(),
    s3: overrides && overrides.s3 ? overrides.s3 : new AWS.S3()
  };
  var nextStep = function(err, data) {
    if (err) {
      data.log({level: "error", message: "Step (index " + (currentStep - 1) +
        ") returned error:", error: err, stack: err.stack});
      context.fail("Error: Step returned error.");
    } else if (steps[currentStep]) {
      if (typeof steps[currentStep] === "function") {
        step = steps[currentStep];
      } else {
        return context.fail("Error: Invalid step encountered.");
      }
      currentStep++;
      step(data, nextStep);
    } else {
      // No more steps exist, so invoke the finish function.
      exports.finish(data);
    }
  };
  nextStep(null, data);
};
