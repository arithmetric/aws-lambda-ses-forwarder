console.log('AWS Lambda SES Forwarder // @arithmetric // Version 1.0.2');

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
var config = {
    'emailBucket': 's3-bucket-name',
    'emailKeyPrefix': 'emailsPrefix/',
    'forwardMapping': {
        'info@example.com': [
            'example.john@example.com',
            'example.jen@example.com'
        ],
        'abuse@example.com': [
            'example.jim@example.com'
        ]
    }
};

var aws = require('aws-sdk');
var ses = new aws.SES();
var s3 = new aws.S3();

exports.handler = function (event, context) {
    // Validate characteristics of a SES event record.
    if (!event.hasOwnProperty('Records') || event.Records.length !== 1 ||
        !event.Records[0].hasOwnProperty('eventSource') || event.Records[0].eventSource !== 'aws:ses' ||
        event.Records[0].eventVersion !== '1.0') {
        return context.fail('Error: Expecting event with source aws:ses and version 1.0, but received: ' + JSON.stringify(event));
    }

    var email = event.Records[0].ses.mail,
      recipients = event.Records[0].ses.receipt.recipients;

    // Determine new recipient
    var forwardEmails = [];
    recipients.forEach(function (origEmail) {
        if (config.forwardMapping.hasOwnProperty(origEmail)) {
            forwardEmails = forwardEmails.concat(config.forwardMapping[origEmail]);
        }
    });

    // Copying email object to ensure read permission
    console.log('Loading email s3://' + config.emailBucket + '/' + config.emailKeyPrefix + email.messageId);
    s3.copyObject({
        Bucket: config.emailBucket,
        CopySource: config.emailBucket + '/' + config.emailKeyPrefix + email.messageId,
        Key: config.emailKeyPrefix + email.messageId,
        ACL: 'private',
        ContentType: 'text/plain',
        StorageClass: 'STANDARD'
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            return context.fail('Error: Could not make readable copy of email.');
        }

        // Load the raw email from S3
        s3.getObject({
            Bucket: config.emailBucket,
            Key: config.emailKeyPrefix + email.messageId
        }, function (err, data) {
            if (err) {
                console.log(err, err.stack);
                return context.fail('Error: Failed to load message body from S3: ' + err);
            }

            console.log('Loaded email body. Preparing to send raw email to: ' + forwardEmails.join(', '));
            var message = data.Body.toString();

            // SES does not allow sending messages from an unverified address,
            // so replace the message's "From:" header with the original
            // recipient (which is a verified domain) and replace any
            // "Reply-To:" header with the original sender.
            message = message.replace(/^Reply-To: (.*)\r?\n/gm, '');
            message = message.replace(/^Return-Path: (.*)\r?\n/gm, '');
            message = message.replace(/^From: (.*)/gm, function (match, from) {
                return 'From: ' + from.replace('<', '(').replace('>', ')') + ' via ' + recipients[0] + ' <' + recipients[0] + '>\nReply-To: ' + email.source;
            });

            // Send email using the SES sendRawEmail command
            var params = {
                Destinations: forwardEmails,
                Source: recipients[0],
                RawMessage: {
                    Data: message
                }
            };
            ses.sendRawEmail(params, function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                    context.fail('Error: Email sending failed.');
                }
                else {
                    console.log(data);
                    context.succeed('Email successfully forwarded for ' + recipients.join(', ') + ' to ' + forwardEmails.join(', '));
                }
            });
        });
    });
};
