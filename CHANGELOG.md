# Change Log for aws-lambda-ses-forwarder

## 4.0.0

- Updated for the Node.js 4.3 runtime.
- Refactored steps to use native JavaScript promises.
- Updating aws-sdk dependency to match AWS Lambda environment.

### Upgrade Notes

- The **Node.js 4.3** Lambda runtime is required for this version.
- The arguments for the handler function have changed to match the Lambda
runtime for **Node.js 4.3** to include a callback function. If invoking the
`handler` function, be sure to include the callback function provided in the
Lambda runtime environment.
- Step functions that include asynchronous operations should return a promise,
and are no longer provided a callback function as an argument. Upon successful
completion of the step function, call `Promise.resolve()` with the `data`
argument given to the step function. (Step functions that are synchronous should
return the `data` argument.)

## 3.0.0 [2016/5/14]

- Adding capability to specify an email forwarding mapping that acts as a
wildcard or catch-all for a domain.
- Converting the inbound recipient email address to lowercase before comparing
to the forwarding map to handle case variations.
- Updating aws-sdk dependency to match AWS Lambda environment.

### Upgrade Notes

- Email addresses and domain wildcard keys in the `forwardMapping` configuration
object must be lowercase.

## 2.3.0 [2016/4/21]

- Adding configuration option for a static "From" email address.

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
