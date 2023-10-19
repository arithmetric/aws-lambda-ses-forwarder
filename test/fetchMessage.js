
/* global describe, it */

var assert = require("assert");

const {GetObjectCommand, CopyObjectCommand} = require('@aws-sdk/client-s3');

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
          log: console.log,
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
          }
        };
        index.fetchMessage(data)
          .then(function(data) {
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
          context: {},
          email: {
            messageId: "abc"
          },
          log: console.log,
          s3: {
            send: function(options, callback) {
              callback(true);
            }
          }
        };
        index.fetchMessage(data)
          .catch(function(err) {
            assert.ok(err, "fetchMessage aborted operation");
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
          context: {},
          email: {
            messageId: "abc"
          },
          log: console.log,
          s3: {
            send: function(options, callback) {
              if (options instanceof CopyObjectCommand)
                callback(null);
              else if (options instanceof GetObjectCommand)
                callback(true);
            }
          }
        };
        index.fetchMessage(data)
          .catch(function(err) {
            assert.ok(err, "fetchMessage aborted operation");
            done();
          });
      });
  });
});
