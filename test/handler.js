
/* global describe, it */

var fs = require("fs");

var index = require("../index");

describe('index.js', function() {
  describe('#handler()', function() {
    it('mock data should result in a success', function(done) {
      var event = JSON.parse(fs.readFileSync("test/assets/event.json"));
      var context = {
        succeed: function() {
          done();
        }
      };
      var overrides = {
        s3: {
          copyObject: function(options, callback) {
            callback(null);
          },
          getObject: function(options, callback) {
            callback(null, "email data");
          }
        },
        ses: {
          sendRawEmail: function(options, callback) {
            callback(null, {status: "ok"});
          }
        },
        config: {
          emailBucket: "bucket",
          emailKeyPrefix: "prefix/",
          forwardMapping: {
            "info@example.com": [
              "jim@example.com"
            ]
          }
        }
      };
      index.handler(event, context, overrides);
    });

    it('default data should result in a failure', function(done) {
      var event = JSON.parse(fs.readFileSync("test/assets/event.json"));
      var context = {
        fail: function() {
          done();
        }
      };
      index.handler(event, context);
    });
  });
});
