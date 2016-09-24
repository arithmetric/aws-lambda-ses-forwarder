
/* global describe, it */

var assert = require("assert");
var fs = require("fs");

var index = require("../index");

describe('index.js', function() {
  describe('#processEvent()', function() {
    it('should process email data and make updates', function(done) {
      var data = {
        config: {},
        email: {
          source: "betsy@example.com"
        },
        emailData: fs.readFileSync("test/assets/message.txt").toString(),
        log: console.log,
        recipients: ["jim@example.com"],
        originalRecipient: "info@example.com"
      };
      var emailDataProcessed = fs.readFileSync(
        "test/assets/message.processed.txt").toString();
      index.processMessage(data, function(err, data) {
        assert.ok(!err, "processEmail returned successfully");
        assert.equal(data.emailData,
          emailDataProcessed,
          "processEmail updated email data");
        done();
      });
    });

    it('should preserve an existing Reply-To header in emails', function(done) {
      var data = {
        config: {},
        email: {
          source: "betsy@example.com"
        },
        emailData:
          fs.readFileSync("test/assets/message.replyto.txt").toString(),
        log: console.log,
        recipients: ["jim@example.com"],
        originalRecipient: "info@example.com"
      };
      var emailDataProcessed = fs.readFileSync(
        "test/assets/message.processed.txt").toString();
      index.processMessage(data, function(err, data) {
        assert.ok(!err, "processEmail returned successfully");
        assert.equal(data.emailData,
          emailDataProcessed,
          "processEmail updated email data");
        done();
      });
    });

    it('should preserve an existing Reply-to header', function(done) {
      var data = {
        config: {},
        email: {
          source: "betsy@example.com"
        },
        emailData:
          fs.readFileSync("test/assets/message.replyto_case.txt").toString(),
        log: console.log,
        recipients: ["jim@example.com"],
        originalRecipient: "info@example.com"
      };
      var emailDataProcessed = fs.readFileSync(
        "test/assets/message.replyto_case.processed.txt").toString();
      index.processMessage(data, function(err, data) {
        assert.ok(!err, "processEmail returned successfully");
        assert.equal(data.emailData,
          emailDataProcessed,
          "processEmail updated email data");
        done();
      });
    });

    it('should allow overriding the From header in emails', function(done) {
      var data = {
        config: {
          fromEmail: "noreply@example.com"
        },
        email: {
          source: "betsy@example.com"
        },
        emailData:
          fs.readFileSync("test/assets/message.txt").toString(),
        log: console.log,
        recipients: ["jim@example.com"],
        originalRecipient: "info@example.com"
      };
      var emailDataProcessed = fs.readFileSync(
        "test/assets/message.fromemail.txt").toString();
      index.processMessage(data, function(err, data) {
        assert.ok(!err, "processEmail returned successfully");
        assert.equal(data.emailData,
          emailDataProcessed,
          "processEmail updated email data");
        done();
      });
    });
  });
});
