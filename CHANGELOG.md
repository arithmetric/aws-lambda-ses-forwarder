# Change Log for aws-lambda-ses-forwarder

## 5.1.0 [2023/10/9]

- Updating documentation about using Node.js 16 or 18 AWS Lambda runtimes.
- Updating tests to support Node.js 16 and later.

## 5.0.0 [2020/6/27]

- Adding `allowPlusSign` configuration flag that when enabled ignores suffixes
after a plus sign in email addresses. For example, an email addressed to
- Adding support for a catch all mapping by using "@" as the key.
`jane+reminder@example.com` is treated as if addressed to `jane@example.com`.
- Fixing handling of emails with less common header formats, such as where there
is no space in the header after the colon and before the value.
- Updating aws-sdk dependency to match AWS Lambda environment.

### Upgrade Notes

- The **Node.js 8** Lambda runtime is required for this version.

## 4.2.0 [2017/6/20]

- Removing `Message-ID` header from messages to fix `InvalidParameterValue:
Duplicate header 'Message-ID'` errors.
- Fixing handling of multiline `From` headers to fix `InvalidParameterValue:
Extra route-addr` errors.
- Updating documentation for SES endpoints.
- Updating aws-sdk dependency to match AWS Lambda environment.

## 4.1.0 [2017/3/10]

- Added `toEmail` configuration for replacing the `To` header recipient to a
defined email address.
- Changed AWS.S3() implementation to use signature version v4 for compatibility
with S3 EU-based regions.

## 4.0.0 [2017/2/22]

- Updated for the Node.js 4.3 runtime.
- Refactored steps to use promises.

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

## 3.2.0 [2017/2/18]

- Added capability to specify an email forwarding mapping based on a mailbox
name across all domains (i.e. forward mail sent to `foo@*`).
- Added documentation to resolve "Could not write to bucket" error.
- Updating aws-sdk dependency to match AWS Lambda environment and other dev
dependencies.

## 3.1.0 [2016/9/24]

- Adding `subjectPrefix` configuration for adding a prefix string to the subject
of forwarded email.
- Updating regex match for the Reply-To header to be case insensitive to support
email sent with a Reply-to header.
- Fixing how libraries are loaded to improve performance.

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
