# Change Log for aws-lambda-ses-forwarder

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
