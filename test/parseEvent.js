
/* global describe, it */

var assert = require("assert");
var fs = require("fs");

var index = require("../index");

describe('index.js', function() {
  describe('#parseEvent()', function() {
    it('should parse email and recipients from an SES event', function(done) {
      var data = {
        event: JSON.parse(fs.readFileSync("test/assets/event.json")),
        log: console.log,
        context: {}
      };
      index.parseEvent(data)
        .then(function(data) {
          assert.equal(data.email.messageId,
            "o3vrnil0e2ic28trm7dakrc2v0clambda4nbp0g1",
            "parseEvent found messageId");
          assert.equal(data.email.source,
            "janedoe@example.com",
            "parseEvent found message source");
          assert.equal(data.recipients[0],
            "info@example.com",
            "parseEvent found message recipients");
          done();
        });
    });

    it('should reject an invalid SES event', function(done) {
      var data = {
        event: {},
        log: console.log,
        context: {}
      };
      index.parseEvent(data)
        .catch(function(err) {
          assert.ok(err, "parseEvent threw an error");
          done();
        });
    });
  });
});
