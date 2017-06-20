
/* global describe, it */

var assert = require("assert");
var fs = require("fs");

var index = require("../index");

describe('index.js', function() {
  describe('#processMessage()', function() {
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
      index.processMessage(data)
        .then(function(data) {
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
      index.processMessage(data)
        .then(function(data) {
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
      index.processMessage(data)
        .then(function(data) {
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
      index.processMessage(data)
        .then(function(data) {
          assert.equal(data.emailData,
            emailDataProcessed,
            "processEmail updated email data");
          done();
        });
    });

    it('should process multiline From header in emails', function(done) {
      var data = {
        config: {
          fromEmail: "noreply@example.com"
        },
        email: {
          source: "betsy@example.com"
        },
        emailData:
          fs.readFileSync("test/assets/message.from_multiline.source.txt").toString(),
        log: console.log,
        recipients: ["jim@example.com"],
        originalRecipient: "info@example.com"
      };
      var emailDataProcessed = fs.readFileSync(
        "test/assets/message.from_multiline.processed.txt").toString();
      index.processMessage(data)
        .then(function(data) {
          assert.equal(data.emailData,
            emailDataProcessed,
            "processEmail updated email data");
          done();
        });
    });

    it('should allow adding a prefix to the Subject in emails', function(done) {
      var data = {
        config: {
          subjectPrefix: "[PREFIX] "
        },
        email: {
          source: "betsy@example.com"
        },
        emailData: fs.readFileSync("test/assets/message.txt").toString(),
        log: console.log,
        recipients: ["jim@example.com"],
        originalRecipient: "info@example.com"
      };
      var emailDataProcessed = fs.readFileSync(
        "test/assets/message.subjectprefix.txt").toString();
      index.processMessage(data)
        .then(function(data) {
          assert.equal(data.emailData,
            emailDataProcessed,
            "processEmail updated email data");
          done();
        });
    });

    it('should allow overriding the To header in emails', function(done) {
      var data = {
        config: {
          toEmail: "actualTarget@example.com"
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
        "test/assets/message.toemail.txt").toString();
      index.processMessage(data)
        .then(function(data) {
          assert.equal(data.emailData,
            emailDataProcessed,
            "processEmail updated email data");
          done();
        });
    });
  });
});
