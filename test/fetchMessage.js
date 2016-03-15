
/* global describe, it */

var assert = require("assert");

var index = require("../index");

describe('index.js', function() {
  describe('#fetchMessage()', function() {
    it('should invoke the AWS S3 SDK to fetch the message',
      function(done) {
        var data = {
          config: {
            emailBucket: "bucket",
            emailKeyPrefix: "prefix/"
          },
          context: {
            fail: function() {
              assert.ok(false, 'context.fail() was called');
              done();
            }
          },
          email: {
            messageId: "abc"
          },
          s3: {
            copyObject: function(options, callback) {
              callback(null);
            },
            getObject: function(options, callback) {
              callback(null, {Body: "email data"});
            }
          }
        };
        index.fetchMessage(data, function(err, data) {
          assert.ok(!err, "fetchMessage returned successfully");
          assert.equal(data.emailData,
            "email data",
            "fetchMessage returned email data");
          done();
        });
      });

    it('should result in failure if the AWS S3 SDK cannot copy the message',
      function(done) {
        var data = {
          config: {
            emailBucket: "bucket",
            emailKeyPrefix: "prefix/"
          },
          context: {
            fail: function() {
              assert.ok(true, "fetchMessage aborted operation");
              done();
            }
          },
          email: {
            messageId: "abc"
          },
          s3: {
            copyObject: function(options, callback) {
              callback(true);
            },
            getObject: function(options, callback) {
              callback(true);
            }
          }
        };
        index.fetchMessage(data, function() {
          assert.ok(false, "fetchMessage aborted operation");
          done();
        });
      });

    it('should result in failure if the AWS S3 SDK cannot get the message',
      function(done) {
        var data = {
          config: {
            emailBucket: "bucket",
            emailKeyPrefix: "prefix/"
          },
          context: {
            fail: function() {
              assert.ok(true, "fetchMessage aborted operation");
              done();
            }
          },
          email: {
            messageId: "abc"
          },
          s3: {
            copyObject: function(options, callback) {
              callback(null);
            },
            getObject: function(options, callback) {
              callback(true);
            }
          }
        };
        index.fetchMessage(data, function() {
          assert.ok(false, "fetchMessage aborted operation");
          done();
        });
      });
  });
});
