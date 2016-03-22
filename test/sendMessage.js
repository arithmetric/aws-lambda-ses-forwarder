
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
          context: {
            fail: function() {
              assert.ok(false, 'context.fail() was called');
              done();
            }
          },
          log: console.log,
          ses: {
            sendRawEmail: function(options, callback) {
              callback(null, {status: "ok"});
            }
          }
        };
        index.sendMessage(data, function(err) {
          assert.ok(!err, "sendMessage returned successfully");
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
          context: {
            fail: function() {
              assert.ok(true, 'sendMessage aborted operation');
              done();
            }
          },
          log: console.log,
          ses: {
            sendRawEmail: function(options, callback) {
              callback(true);
            }
          }
        };
        index.sendMessage(data, function() {
          assert.ok(false, "sendMessage aborted operation");
          done();
        });
      });
  });
});
