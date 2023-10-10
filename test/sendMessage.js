
/* global describe, it */

var assert = require("assert");

var index = require("../index");

describe('index.js', function() {
  describe('#sendMessage()', function() {
    it('should invoke the AWS SES SDK to send the message',
      function(done) {
        var data = {
          recipients: [
            "jim@example.com"
          ],
          originalRecipients: [
            "info@example.com"
          ],
          emailData: "message data",
          context: {},
          log: console.log,
          ses: {
            send: function(options, callback) {
              callback(null, {status: "ok"});
            }
          }
        };
        index.sendMessage(data)
          .then(function() {
            assert.ok(true, "sendMessage returned successfully");
            done();
          });
      });

    it('should result in failure if the AWS SES SDK cannot send the message',
      function(done) {
        var data = {
          recipients: [
            "jim@example.com"
          ],
          originalRecipients: [
            "info@example.com"
          ],
          emailData: "message data",
          context: {},
          log: console.log,
          ses: {
            send: function(options, callback) {
              callback(true);
            }
          }
        };
        index.sendMessage(data)
          .catch(function(err) {
            assert.ok(err, "sendMessage aborted operation");
            done();
          });
      });
  });
});
