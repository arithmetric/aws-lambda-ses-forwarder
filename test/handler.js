
/* global describe, it */

var assert = require("assert");
var fs = require("fs");

const {GetObjectCommand, CopyObjectCommand} = require('@aws-sdk/client-s3');

var index = require("../index");

describe('index.js', function() {
  describe('#handler()', function() {
    it('mock data should result in a success', function(done) {
      var event = JSON.parse(fs.readFileSync("test/assets/event.json"));
      var context = {};
      var callback = function() {
        done();
      };
      var overrides = {
        s3: {
          send: function(options, callback) {
            if (options instanceof CopyObjectCommand)
              callback(null);
            else if (options instanceof GetObjectCommand)
              callback(null, {
                Body: {
                  transformToString: function() {
                    return "email data";
                  }
                }
              });
          }
        },
        ses: {
          send: function(options, callback) {
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
      index.handler(event, context, callback, overrides);
    });

    it('should accept functions as steps', function(done) {
      var event = {};
      var context = {};
      var callback = function() {};
      var overrides = {
        steps: [
          function(data) {
            if (data && data.context) {
              done();
            }
          }
        ]
      };
      index.handler(event, context, callback, overrides);
    });

    it('should report failure for invalid steps', function(done) {
      var event = {};
      var context = {};
      var callback = function(err) {
        if (err) assert.ok(true, "callback function received error");
        done();
      };
      var overrides = {
        steps: [
          1,
          ['test']
        ]
      };
      index.handler(event, context, callback, overrides);
    });

    it('should report failure for steps passing an error', function(done) {
      var event = {};
      var context = {};
      var callback = function(err) {
        done(err ? null : true);
      };
      var overrides = {
        steps: [
          function(data, next) {
            next(true, data);
          }
        ],
        log: function() {
          assert.ok(true, "custom log function called successfully");
        }
      };
      index.handler(event, context, callback, overrides);
    });
  });
});
