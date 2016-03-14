
/* global describe, it */

var assert = require("assert");
var fs = require("fs");

var index = require("../index");

describe('index.js', function() {
  describe('#processEvent()', function() {
    it('should process email data and make updates', function(done) {
      var data = {
        email: {
          source: "betsy@example.com"
        },
        emailData: fs.readFileSync("test/assets/message.txt").toString(),
        recipients: ["jim@example.com"]
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
  });
});
