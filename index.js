"use strict";

var AWS = require('aws-sdk');

console.log("AWS Lambda SES Forwarder // @arithmetric // Version 5.0.0");

// Configure the S3 bucket and key prefix for stored raw emails, and the
// mapping of email addresses to forward from and to.
//
// IAM access:
// {
//  "Version": "2020-01-01",
//  "Statement": [
//      {
//          "Effect": "Allow",
//          "Action": [
//              "logs:CreateLogGroup",
//              "logs:CreateLogStream",
//              "logs:PutLogEvents"
//          ],
//          "Resource": "arn:aws:logs:*:*:*"
//      },
//      {
//          "Effect": "Allow",
//          "Action": [
//              "ses:SendRawEmail",
//              "ses:SendEmail"
//          ],
//          "Resource": "*"
//      },
//      {
//          "Effect": "Allow",
//          "Action": [
//              "s3:GetObject",
//              "s3:PutObject"
//          ],
//          "Resource": "arn:aws:s3:::s3-bucket-name/emailsPrefix/*"
//      }
//  ]
// }
//
// Expected keys/values:
//
// - fromEmail: Forwarded emails will come from this verified address
//
// - notifyEmail: This will be used to notify the sender, if the mail could not
//   be delivered.
//
// - notify550: Enables auto response when email address was not found.
//
// - notify552: Enables auto response if mail is larger than 10 MB.
//
// - subjectPrefix: Forwarded emails subject will contain this prefix
//
// - emailBucket: S3 bucket name where SES stores emails.
//
// - emailKeyPrefix: S3 key name prefix where SES stores email. Include the
//   trailing slash.
//
// - allowPlusSign: Enables support for plus sign suffixes on email addresses.
//   If set to `true`, the username/mailbox part of an email address is parsed
//   to remove anything after a plus sign. For example, an email sent to
//   `example+test@example.com` would be treated as if it was sent to
//   `example@example.com`.
//
// - forwardMapping: Object where the key is the lowercase email address from
//   which to forward and the value is an array of email addresses to which to
//   send the message.
//
//   To match all email addresses on a domain, use a key without the name part
//   of an email address before the "at" symbol (i.e. `@example.com`).
//
//   To match a mailbox name on all domains, use a key without the "at" symbol
//   and domain part of an email address (i.e. `info`).
//
//   To match all email addresses matching no other mapping, use "@" as a key.
var defaultConfig = {
  fromEmail: "noreply@example.com",
  notifyEmail: "MAILER-DAEMON@example.com",
  notify550: true,
  notify552: true,
  subjectPrefix: "",
  emailBucket: "s3-bucket-name",
  emailKeyPrefix: "emailsPrefix/",
  allowPlusSign: true,
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
    ],
    "info": [
      "info@example.com"
    ]
  }
};

/**
 * Parses the SES event record provided for the `mail` and `receipients` data.
 *
 * @param {object} data - Data bundle with context, email, etc.
 *
 * @return {object} - Promise resolved with data.
 */
exports.parseEvent = function(data) {
  // Validate characteristics of a SES event record.
  if (!data.event ||
      !data.event.hasOwnProperty('Records') ||
      data.event.Records.length !== 1 ||
      !data.event.Records[0].hasOwnProperty('eventSource') ||
      data.event.Records[0].eventSource !== 'aws:ses' ||
      data.event.Records[0].eventVersion !== '1.0') {
    data.log({
      message: "parseEvent() received invalid SES message:",
      level: "error", event: JSON.stringify(data.event)
    });
    return Promise.reject(new Error('Error: Received invalid SES message.'));
  }

  data.email = data.event.Records[0].ses.mail;
  data.recipients = data.event.Records[0].ses.receipt.recipients;
  return Promise.resolve(data);
};

/**
 * Transforms the original recipients to the desired forwarded destinations.
 *
 * @param {object} data - Data bundle with context, email, etc.
 *
 * @return {object} - Promise resolved with data.
 */
exports.transformRecipients = function(data) {
  var newRecipients = [];
  data.originalRecipients = data.recipients;
  data.recipients.forEach(function(origEmail) {
    var origEmailKey = origEmail.toLowerCase();
    if (data.config.allowPlusSign) {
      origEmailKey = origEmailKey.replace(/\+.*?@/, '@');
    }
    if (data.config.forwardMapping.hasOwnProperty(origEmailKey)) {
      newRecipients = newRecipients.concat(
        data.config.forwardMapping[origEmailKey]);
      data.originalRecipient = origEmail;
    } else {
      var origEmailDomain;
      var origEmailUser;
      var pos = origEmailKey.lastIndexOf("@");
      if (pos === -1) {
        origEmailUser = origEmailKey;
      } else {
        origEmailDomain = origEmailKey.slice(pos);
        origEmailUser = origEmailKey.slice(0, pos);
      }
      if (origEmailDomain &&
          data.config.forwardMapping.hasOwnProperty(origEmailDomain)) {
        newRecipients = newRecipients.concat(
          data.config.forwardMapping[origEmailDomain]);
        data.originalRecipient = origEmail;
      } else if (origEmailUser &&
        data.config.forwardMapping.hasOwnProperty(origEmailUser)) {
        newRecipients = newRecipients.concat(
          data.config.forwardMapping[origEmailUser]);
        data.originalRecipient = origEmail;
      } else if (data.config.forwardMapping.hasOwnProperty("@")) {
        newRecipients = newRecipients.concat(
          data.config.forwardMapping["@"]);
        data.originalRecipient = origEmail;
      }
    }
  });

  if (!newRecipients.length) {
    data.log({
      message: "Finishing process. No new recipients found for " +
        "original destinations: " + data.originalRecipients.join(", "),
      level: "info"
    });
    if (data.config.notify550) {
      data.smtpErr = "550";
    } else {
      return data.callback();
    }
  }

  data.recipients = newRecipients;
  return Promise.resolve(data);
};

/**
 * Fetches the message data from S3.
 *
 * @param {object} data - Data bundle with context, email, etc.
 *
 * @return {object} - Promise resolved with data.
 */
exports.fetchMessage = function(data) {
  // Copying email object to ensure read permission
  data.log({
    level: "info",
    message: "Fetching email at s3://" + data.config.emailBucket + '/' +
      data.config.emailKeyPrefix + data.email.messageId
  });
  return new Promise(function(resolve, reject) {
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
        data.log({
          level: "error",
          message: "copyObject() returned error:",
          error: err,
          stack: err.stack
        });
        return reject(
          new Error("Error: Could not make readable copy of email."));
      }

      // Load the raw email from S3
      data.s3.getObject({
        Bucket: data.config.emailBucket,
        Key: data.config.emailKeyPrefix + data.email.messageId
      }, function(err, result) {
        if (err) {
          data.log({
            level: "error",
            message: "getObject() returned error:",
            error: err,
            stack: err.stack
          });
          return reject(
            new Error("Error: Failed to load message body from S3."));
        }
        // Check content lenght (SES hardcoded 10 MB - 10_000_000 bytes)
        if (result.ContentLength >= 10000000) {
          if (data.config.notify552) {
            data.smtpErr = "552",
            data.log({
              level: "info",
              message: "ContentLength > 10 MB, size = " + result.ContentLength + " bytes (SMTP 552)"
            });
          } else {
            data.log({
              level: "error",
              message: "ContentLength > 10 MB, size = " + result.ContentLength + " bytes (SMTP 552)"
            });
            return reject(
              new Error("Error: Mail size exceeds 10 MB."));
          }
        }
        data.emailData = result.Body.toString();
        return resolve(data);
      });
    });
  });
};

/**
 * Processes the message data, making updates to recipients and other headers
 * before forwarding message.
 *
 * @param {object} data - Data bundle with context, email, etc.
 *
 * @return {object} - Promise resolved with data.
 */
exports.processMessage = function(data) {
  var match = data.emailData.match(/^((?:.+\r?\n)*)(\r?\n(?:.*\s+)*)/m);
  var header = match && match[1] ? match[1] : data.emailData;
  var body = match && match[2] ? match[2] : '';

  // Add "Reply-To:" with the "From" address if it doesn't already exists
  if (!/^reply-to:[\t ]?/mi.test(header)) {
    match = header.match(/^from:[\t ]?(.*(?:\r?\n\s+.*)*\r?\n)/mi);
    var from = match && match[1] ? match[1] : '';
    if (from) {
      header = header + 'Reply-To: ' + from;
      data.from = from;
      data.log({
        level: "info",
        message: "Added Reply-To address of: " + from
      });
    } else {
      data.log({
        level: "info",
        message: "Reply-To address not added because From address was not " +
          "properly extracted."
      });
    }
  }

  // SES does not allow sending messages from an unverified address,
  // so replace the message's "From:" header with the original
  // recipient (which is a verified domain)
  header = header.replace(
    /^from:[\t ]?(.*(?:\r?\n\s+.*)*)/mgi,
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

  // Add a prefix to the Subject
  if (data.config.subjectPrefix) {
    header = header.replace(
      /^subject:[\t ]?(.*)/mgi,
      function(match, subject) {
        data.subject = subject;
        return 'Subject: ' + data.config.subjectPrefix + subject;
      });
  }

  // Replace original 'To' header with a manually defined one
  if (data.config.toEmail) {
    header = header.replace(/^to:[\t ]?(.*)/mgi, () => 'To: ' + data.config.toEmail);
  }

  // Remove the Return-Path header.
  header = header.replace(/^return-path:[\t ]?(.*)\r?\n/mgi, '');

  // Remove Sender header.
  header = header.replace(/^sender:[\t ]?(.*)\r?\n/mgi, '');

  // Remove Message-ID header.
  header = header.replace(/^message-id:[\t ]?(.*)\r?\n/mgi, '');

  // Remove all DKIM-Signature headers to prevent triggering an
  // "InvalidParameterValue: Duplicate header 'DKIM-Signature'" error.
  // These signatures will likely be invalid anyways, since the From
  // header was modified.
  header = header.replace(/^dkim-signature:[\t ]?.*\r?\n(\s+.*\r?\n)*/mgi, '');

  data.emailData = header + body;
  return Promise.resolve(data);
};

/**
 * Send email using the SES sendRawEmail command.
 *
 * @param {object} data - Data bundle with context, email, etc.
 *
 * @return {object} - Promise resolved with data.
 */
exports.sendMessage = function(data) {
  var params = {
    Destinations: data.recipients,
    Source: data.originalRecipient,
    RawMessage: {
      Data: data.emailData
    }
  };
  
  // Format params if we are bouncing
  if (data.smtpErr != "" && data.config.notifyEmail != "") {
    var bounceData = "";
    switch (data.smtpErr) {
      case '552':
        bounceData = "Your email was rejected. Please ensure that the size of your mail is less than 10 MB.\n\n" + "SMTP Reply Code = 552, SMTP Status Code = 5.3.4";
        break;
      case '550':
        bounceData = "Your email was rejected. The email address was not found. Please check the receiving email address.\n\n" + "SMTP Reply Code = 550, SMTP Status Code = 5.1.1";
        break;
      default:
        bounceData = "Unknown error"
    }
    
    params = {
      Destination: {
        ToAddresses: data.from.split()
      },
      Source: data.config.notifyEmail,
      Message: {
        Subject: {
          Data: "Delivery Status Notification (Failure)"
        },
        Body: {
          Text: {
            Data: "An error occurred while trying to deliver the mail to the following recipients: " + data.originalRecipients + "\n\n" + bounceData
          }
        }
      }
    };
    
    data.log({
      level: "info",
      message: "sendMessage: Sending bounce email via SES. Recipients: " +
        data.originalRecipients + ". Bounce code: " + data.smtpErr
    });
  } else {
    data.log({
      level: "info",
      message: "sendMessage: Sending email via SES. Original recipients: " +
        data.originalRecipients.join(", ") + ". Transformed recipients: " +
        data.recipients.join(", ") + "."
    });
  }
    
  return new Promise(function(resolve, reject) {
    if (data.smtpErr != "" && data.config.notifyEmail != "") {
      // If bounce
      data.ses.sendEmail(params, function(err, result) {
        if (err) {
          data.log({
            level: "error",
            message: "sendRawEmail() data.smtpErr returned error.",
            error: err,
            stack: err.stack
          });
          return reject(new Error('Error: Email sending failed.'));
        }
        data.log({
          level: "info",
          message: "sendRawEmail() data.smtpErr successful.",
          result: result
        });
        resolve(data);
      });
    
    } else {
      // If OK
      data.ses.sendRawEmail(params, function(err, result) {
        if (err) {
          data.log({
            level: "error",
            message: "sendRawEmail() returned error.",
            error: err,
            stack: err.stack
          });
          return reject(new Error('Error: Email sending failed.'));
        }
        data.log({
          level: "info",
          message: "sendRawEmail() successful.",
          result: result
        });
        resolve(data);
      });
    }
  });
};

/**
 * Handler function to be invoked by AWS Lambda with an inbound SES email as
 * the event.
 *
 * @param {object} event - Lambda event from inbound email received by AWS SES.
 * @param {object} context - Lambda context object.
 * @param {object} callback - Lambda callback object.
 * @param {object} overrides - Overrides for the default data, including the
 * configuration, SES object, and S3 object.
 */
exports.handler = function(event, context, callback, overrides) {
  var steps = overrides && overrides.steps ? overrides.steps :
    [
      exports.parseEvent,
      exports.transformRecipients,
      exports.fetchMessage,
      exports.processMessage,
      exports.sendMessage
    ];
  var data = {
    event: event,
    callback: callback,
    context: context,
    from: "",
    subject: "",
    smtpErr: "",
    config: overrides && overrides.config ? overrides.config : defaultConfig,
    log: overrides && overrides.log ? overrides.log : console.log,
    ses: overrides && overrides.ses ? overrides.ses : new AWS.SES(),
    s3: overrides && overrides.s3 ?
      overrides.s3 : new AWS.S3({signatureVersion: 'v4'})
  };
  Promise.series(steps, data)
    .then(function(data) {
      data.log({
        level: "info",
        message: "Process finished successfully."
      });
      return data.callback();
    })
    .catch(function(err) {
      data.log({
        level: "error",
        message: "Step returned error: " + err.message,
        error: err,
        stack: err.stack
      });
      return data.callback(new Error("Error: Step returned error."));
    });
};

Promise.series = function(promises, initValue) {
  return promises.reduce(function(chain, promise) {
    if (typeof promise !== 'function') {
      return Promise.reject(new Error("Error: Invalid promise item: " +
        promise));
    }
    return chain.then(promise);
  }, Promise.resolve(initValue));
};
