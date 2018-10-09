"use strict";

var AWS = require('aws-sdk');

console.log("AWS Lambda SES Forwarder // @arithmetric // Version 3.1.0");

// Configure the S3 bucket and key prefix for stored raw emails, and the
// mapping of email addresses to forward from and to.
//
// Expected keys/values:
// - fromEmail: Forwarded emails will come from this verified address
// - subjectPrefix: Forwarded emails subject will contain this prefix
// - emailBucket: S3 bucket name where SES stores emails.
// - emailKeyPrefix: S3 key name prefix where SES stores email. Include the
//   trailing slash.
// - forwardMapping: Object where the key is the email address from which to
//   forward and the value is an array of email addresses to which to send the
//   message. To match all email addresses on a domain, use a key without the
//   name part of an email address before the "at" symbol (i.e. `@example.com`).
//   The key must be lowercase.
var defaultConfig = {
  // Uncomment this if you want to use smtp instead of SES
  //smtp_info: {
  //  region: "aws-region",
  //  // The aws secret contains the 
  //  secretName: "name of aws secret",
  //},
  fromEmail: "noreply@example.com",
  subjectPrefix: "",
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
    ],
    "info" : [
      "info@example.com"
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
      var origEmailUser;
      var pos = origEmailKey.lastIndexOf("@");
      if (pos !== -1) {
        origEmailDomain = origEmailKey.slice(pos);
	origEmailUser = origEmailKey.slice(0, pos);
      } else {
	  origEmailUser = origEmailKey;
      }
      if (origEmailDomain &&
          data.config.forwardMapping.hasOwnProperty(origEmailDomain)) {
        newRecipients = newRecipients.concat(
          data.config.forwardMapping[origEmailDomain]);
        data.originalRecipient = origEmail;
      }
      if (origEmailUser &&
	    data.config.forwardMapping.hasOwnProperty(origEmailUser)) {
            newRecipients = newRecipients.concat(
		data.config.forwardMapping[origEmailUser]);
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
  if (!/^Reply-To: /mi.test(header)) {
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

  // Add a prefix to the Subject
  if (data.config.subjectPrefix) {
    header = header.replace(
      /^Subject: (.*)/mg,
      function(match, subject) {
        return 'Subject: ' + data.config.subjectPrefix + subject;
      });
  }

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
 * Send email using an SMTP Server drop in replacement for ses.sendRawMessage
 * more or less.
 *
 * @param {object} config - The config object to get the smtp info out of.
 * @param {object} params - params includes destination, source, and raw message
 * @param {function} callback - Callback function invoked as (error, data).
 */
exports.sendSMTPEmail = function (config, params, callback) {
  var secretsmanager = new AWS.SecretsManager({region: config.smtp_info.region });
  secretsmanager.getSecretValue({SecretId: config.smtp_info.secretName},
    function(err, data) {
    if (err) {
      callback(err, null);
    }	else if (! ('SecretString' in data )) {
      console.log({ level: 'debug', message: 'no secret string.'});
      callback(new Error('No Secret String'), null);
    } else {
      var smtp_info = JSON.parse(data.SecretString);
      
    console.log({level: 'debug', message:'host=' + smtp_info.server +
		   ' port=' + smtp_info.port +
		   ' username=' + smtp_info.username});
      
      var smtp_client = require('smtp-client');
      var mail_client = new smtp_client.SMTPClient({
	      host: smtp_info.server,
	      port: parseInt(smtp_info.port, 10),
	      secure: true,
	      timeout: 60000
      });

		  var done = false;
      var sendit = async function(smtp_info, params) {
	await mail_client.connect();
	//await mail_client.secure({timeout: 30000});
	// runs EHLO command or HELO as a fallback	
	await mail_client.greet({hostname: smtp_info.server});
	// authenticates a user
	await mail_client.authPlain({username: smtp_info.username,
				     password: smtp_info.password});
	// runs MAIL FROM command
	await mail_client.mail({from: params.Source});
	// runs RCPT TO command (run this multiple times to add more recii)
		console.log({level: 'debug', message: 'Destinations = ' + params.Destinations});
		if (! params.Destinations instanceof Array) {
		  params.Destinations = [ params.Destinations];
		}
		for (var i = 0; i < params.Destinations.length; i++) {
	      var email = params.Destinations[i];
	      console.log({level: 'debug', message:'did to: ' + email});
	      await mail_client.rcpt({to: email});
		}

	// runs DATA command and streams email source
	await mail_client.data(params.RawMessage.Data);
	// runs QUIT command
	await mail_client.quit();
      };
      sendit(smtp_info, params).catch(function(err) {
        done = true;
	    console.log({level: 'error', message: 'send smtp ' + err + " " + err.stack});
	    callback(err, null);
      }).then(function(response) {
        if (!done) {
          callback(null, response);
        }
      });
    }
  });
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
  data.ses.sendRawEmail(data.config, params, function(err, result) {
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
    s3: overrides && overrides.s3 ? overrides.s3 : new AWS.S3()
  };
  data['ses'] = overrides && overrides.ses ? overrides.ses : (
    'smtp_info' in data ['config'] ? {
      sendRawEmail: function(config, params, callback) {
	exports.sendSMTPEmail(config, params, callback);
      }
    } : {
      sendRawEmail: function(config, params, callback) {
        new AWS.SES().sendRawEmail(params, callback);
  }});

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
