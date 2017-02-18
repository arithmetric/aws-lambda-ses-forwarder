
/* global describe, it */

var assert = require("assert");

var index = require("../index");

describe('index.js', function() {
  describe('#transformRecipients()', function() {
    it('should transform recipients according to the provided mapping',
      function(done) {
        var data = {
          recipients: ["info@example.com"],
          config: {
            forwardMapping: {
              "info@example.com": [
                "jim@example.com",
                "jane@example.com"
              ]
            }
          },
          context: {
            succeed: function() {
              assert.ok(false,
                'context.succeed() was called, but should not be');
              done();
            }
          },
          log: console.log
        };
        index.transformRecipients(data, function(err, data) {
          assert.ok(!err, "transformRecipients returned successfully");
          assert.equal(data.recipients[0],
            "jim@example.com",
            "parseEvent made 1/2 substitutions");
          assert.equal(data.recipients[1],
            "jane@example.com",
            "parseEvent made 2/2 substitutions");
          done();
        });
      });

    it('should transform recipients in a case insensitive way',
      function(done) {
        var data = {
          recipients: ["INFO@EXAMPLE.COM"],
          config: {
            forwardMapping: {
              "info@example.com": [
                "jim@example.com",
                "jane@example.com"
              ]
            }
          },
          context: {
            succeed: function() {
              assert.ok(false,
                'context.succeed() was called, but should not be');
              done();
            }
          },
          log: console.log
        };
        index.transformRecipients(data, function(err, data) {
          assert.ok(!err, "transformRecipients returned successfully");
          assert.equal(data.recipients[0],
            "jim@example.com",
            "parseEvent made 1/2 substitutions");
          assert.equal(data.recipients[1],
            "jane@example.com",
            "parseEvent made 2/2 substitutions");
          done();
        });
      });

    it('should transform recipients according to a domain wildcard mapping',
      function(done) {
        var data = {
          recipients: ["info@EXAMPLE.com"],
          config: {
            forwardMapping: {
              "@example.com": [
                "jim@example.com",
                "jane@example.com"
              ]
            },
            log: console.log
          }
        };
        index.transformRecipients(data, function(err, data) {
          assert.ok(!err, "transformRecipients returned successfully");
          assert.equal(data.recipients[0],
            "jim@example.com",
            "parseEvent made 1/2 substitutions");
          assert.equal(data.recipients[1],
            "jane@example.com",
            "parseEvent made 2/2 substitutions");
          done();
        });
      });

    it('should transform recipients according to a user wildcard mapping',
      function(done) {
        var data = {
          recipients: ["info@foo.com"],
          config: {
            forwardMapping: {
              info: [
                "jim@example.com",
                "jane@example.com"
              ]
            },
            log: console.log
          }
        };
        index.transformRecipients(data, function(err, data) {
          assert.ok(!err, "transformRecipients returned successfully");
          assert.equal(data.recipients[0],
            "jim@example.com",
            "parseEvent made 1/2 substitutions");
          assert.equal(data.recipients[1],
            "jane@example.com",
            "parseEvent made 2/2 substitutions");
          done();
        });
      });

    it('should exit if there are no new recipients',
      function(done) {
        var data = {
          recipients: ["noreply@example.com"],
          config: {
            forwardMapping: {
              "info@example.com": [
                "jim@example.com"
              ]
            }
          },
          context: {
            succeed: function() {
              done();
            }
          },
          log: console.log
        };
        index.transformRecipients(data, function() {
          assert.ok(false, "transformRecipients should not invoke callback");
          done();
        });
      });

    it('should support matching a name without domain',
      function(done) {
        var data = {
          recipients: ["info"],
          config: {
            forwardMapping: {
              info: [
                "jim@example.com"
              ]
            }
          },
          log: console.log
        };
        index.transformRecipients(data, function(err, data) {
          assert.ok(!err, "transformRecipients returned successfully");
          assert.equal(data.recipients[0],
            "jim@example.com",
            "parseEvent made substitution");
          done();
        });
      });

    it('should exit if the recipient is malformed',
      function(done) {
        var data = {
          recipients: ["example.com"],
          config: {
            forwardMapping: {
              "@example.com": [
                "jim@example.com"
              ]
            }
          },
          context: {
            succeed: function() {
              done();
            }
          },
          log: console.log
        };
        index.transformRecipients(data, function() {
          assert.ok(false, "transformRecipients should not invoke callback");
          done();
        });
      });
  });
});
