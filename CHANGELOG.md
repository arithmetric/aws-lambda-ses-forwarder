# Change Log for aws-lambda-ses-forwarder

## 2.3.0 [2016/4/14]

- Option for static from email address

## 2.2.0 [2016/3/30]

- Removing all DKIM-Signature headers to prevent errors when forwarding or DKIM
verification issues when received.
- Updating the email processing to remove any Sender header and to only add a
Reply-To header if one does not already exist.

## 2.1.0 [2016/3/22]

- Allowing the log function to be overridden.
- Reworking log output as structured data.

## 2.0.0 [2016/3/16]

- Major refactor for configurability and testability.
- Adding test coverage with Mocha and Istanbul and configuration for eslint.
- Removing DKIM-Signature headers for the amazonses.com domain to prevent error
when forwarding.
- Improving format of modified From header.
- Adding documentation and example for implementing this module.

## 1.0.2 [2016/2/23]

- Ensuring empty lines are not left when the headers are altered.
- Removing any Return-Path headers.

## 1.0.1 [2015/12/3]

- Removing any Reply-To headers to prevent conflicts with the new headers added.

## 1.0.0 [2015/11/2]

- Initial release of aws-lambda-ses-forwarder.
