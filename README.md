# AWS Lambda SES Email Forwarder

[![npm version](https://badge.fury.io/js/aws-lambda-ses-forwarder.svg)](https://www.npmjs.com/package/aws-lambda-ses-forwarder)
[![Travis CI test status](https://travis-ci.org/arithmetric/aws-lambda-ses-forwarder.svg?branch=master)](https://travis-ci.org/arithmetric/aws-lambda-ses-forwarder)
[![Test coverage status](https://coveralls.io/repos/github/arithmetric/aws-lambda-ses-forwarder/badge.svg?branch=master)](https://coveralls.io/github/arithmetric/aws-lambda-ses-forwarder?branch=master)

An AWS Lambda Node.js script that uses the inbound and outbound capabilities
of AWS Simple Email Service (SES) to run a serverless email forwarding
service.

Instead of setting up an email server on an EC2 instance to handle email
redirects, use SES to receive email, the included Lambda script to process it
and then send it on to the final destination.

## Limitations

- SES only allows sending email from addresses or domains that are verified.
Since this script is meant to allow forwarding email from any sender, the
message is modified to allow forwarding through SES and reflect the original
sender. This scripts adds a Reply-To header with the original sender, but the
From header is changed to display the original sender but to be sent from the
original destination.

  For example, if an email sent by "Jane Example <jane@example.com>" to
  info@example.com is processed by this script, the From and Reply-To headers
  will be set to:

  ```
  From: Jane Example at jane@example.com <info@example.com>
  Reply-To: jane@example.com
  ```

- SES only allows receiving email sent to addresses within verified domains. For
more information, see:
http://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-domains.html

- Initially SES users are in a sandbox environment that has a number of
limitations. See:
http://docs.aws.amazon.com/ses/latest/DeveloperGuide/limits.html

## Set Up

1. Modify the values in the `config` object at the top of `index.js` to specify
the S3 bucket and object prefix for locating emails stored by SES. Also provide
the email forwarding mapping from original destinations to new destination.

2. In AWS Lambda, add a new function and skip selecting a blueprint.

 - Name the function "SesForwarder" and optionally give it a description. Ensure
 Runtime is set to Node.js.

 - For the Lambda function code, either copy and paste the contents of
 `index.js` into the inline code editor or zip the contents of the repository
 and upload them directly or via S3.

 - Ensure Handler is set to `index.handler`.

 - For Role, choose "Basic Execution Role" under Create New Role. In the popup,
 give the role a name.

3. Configure the IAM role you created for the Lambda function to have policies
that grant access to get and put objects in the S3 bucket and to send raw emails
using SES.

4. In AWS SES, verify the domains for which you want to receive and forward
email. Also configure the DNS MX record for these domains to point to the SES
endpoint provided.

5. If you have the sandbox level of access to SES, then also verify any email
addresses to which you want to forward email that are not on verified domains.

6. If you have not configured inbound email handling, create a new Rule Set.
Otherwise, you can use an existing one.

7. Create a rule for handling email forwarding functionality.

 - On the Recipients configuration page, add any email addresses from which you
 want to forward email.

 - On the Actions configuration page, add an S3 action first and then an Lambda
 action.

 - For the S3 action: Create or choose an existing S3 bucket. Optionally, add an
 object key prefix. Leave KMS Key and SNS Topic set to [none].

 - For the Lambda action: Choose the SesForwarder Lambda function. Leave
 Invocation Type and SNS Topic set to [none].

 - Finish by naming the rule, ensuring it's enabled and that spam and virus
 checking are used.

8. The S3 bucket policy needs to be configured so that your IAM user has read
and write access to the S3 bucket. When you set up the S3 action in SES, it may
add a bucket policy statement that denies all users other than root access to
get objects. This causes access issues from the Lambda script, so you may need
to replace the deny statement with one like this:
```
{
  "Sid": "AllowEmailUsersRoles",
  "Effect": "Allow",
  "Principal": {
    "AWS": [
      "arn:aws:iam::AWS-ACCOUNT-ID:root",
      "arn:aws:iam::AWS-ACCOUNT-ID:user/MY-AWS-USER-NAME",
      "arn:aws:iam::AWS-ACCOUNT-ID:role/LAMBDA-IAM-ROLE-NAME"
    ]
  },
  "Action": [
    "s3:GetObjectAcl",
    "s3:GetObject",
    "s3:PutObjectAcl",
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::S3-BUCKET-NAME/*"
}
```

9. Optionally set the S3 lifecycle for this bucket to delete/expire objects
after a few days to clean up the saved emails.

## Extending

By loading aws-lambda-ses-forwarder as a module in a Lambda script, you can
override the default config settings, change the order in which to process
tasks, and add functions as custom tasks.

The overrides object should may have the following keys:
- `config`: An object that defines the S3 storage location and mapping for
email forwarding.
- `steps`: An array of functions that should be executed to process and forward
the email. See `index.js` for the default set of steps.

See `example/` for a demonstration of providing configuration as overrides.

## Troubleshooting

Test the configuration by sending emails to recipient addresses.

- If you receive a bounce from AWS with the message `"This message could not be
delivered due to a recipient error."`, then the rules could not be executed.
Check the configuration of the rules.

- Check if you find an object associated with the message in the S3 bucket.

- If your Lambda script has syntax mistakes or hits an error, these are logged
in CloudWatch. Click on "Logs" in the CloudWatch menu, and you should find a log
group for the Lambda function.

## Credits

Based on the work of @eleven41 and @mwhouser from:
https://github.com/eleven41/aws-lambda-send-ses-email
