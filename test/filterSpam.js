
/* global describe, it */

var assert = require("assert");
var fs = require("fs");

var index = require("../index");

describe('index.js', function() {
  describe('#filterSpam()', function() {
    it('skip if not configured',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {}
        };
        index.filterSpam(data)
          .then(function() {
            assert.ok(true, "filterSpam returned successfully");
            done();
          });
      });

    it('skip if filtering disabled',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {rejectSpam: false}
        };
        index.filterSpam(data)
          .then(function() {
            assert.ok(true, "filterSpam returned successfully");
            done();
          });
      });

    it('allow good message through',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {rejectSpam: true}
        };
        index.filterSpam(data)
          .then(function() {
            assert.ok(true, "filterSpam returned successfully");
            done();
          });
      });

    it('should reject spam messages',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {rejectSpam: true}
        };
        data.event.Records[0].ses.receipt.spamVerdict.status = "FAIL";
        index.filterSpam(data)
          .catch(function(err) {
            assert.ok(err, "Error: Email failed spam filter: spamVerdict");
            done();
          });
      });

    it('should reject messages that might have a virus',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {rejectSpam: true}
        };
        data.event.Records[0].ses.receipt.virusVerdict.status = "FAIL";
        index.filterSpam(data)
          .catch(function(err) {
            assert.ok(err, "Error: Email failed spam filter: virusVerdict");
            done();
          });
      });

    it('should reject messages that fail a DKIM check',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {rejectSpam: true}
        };
        data.event.Records[0].ses.receipt.dkimVerdict.status = "FAIL";
        index.filterSpam(data)
          .catch(function(err) {
            assert.ok(err, "Error: Email failed spam filter: dkimVerdict");
            done();
          });
      });

    it('should reject messages that fail a SPF check',
      function(done) {
        var data = {
          event: JSON.parse(fs.readFileSync("test/assets/event.json")),
          log: console.log,
          context: {},
          config: {rejectSpam: true}
        };
        data.event.Records[0].ses.receipt.spfVerdict.status = "FAIL";
        index.filterSpam(data)
          .catch(function(err) {
            assert.ok(err, "Error: Email failed spam filter: spfVerdict");
            done();
          });
      });
  });
});
