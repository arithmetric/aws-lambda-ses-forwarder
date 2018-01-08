
/* global describe, it */

var assert = require("assert");

var index = require("../index");

describe('index.js', function() {
  describe('#emailCleanupOnS3()', function() {
    it('should simply return data when emailCleanupOnS3 is false',
      function(done) {
        var data = {
          config: {
            emailCleanupOnS3: false
          }
        };
        index.emailCleanupOnS3(data)
          .then(function() {
            assert.ok(true, "emailCleanupOnS3 returned successfully");
            done();
          });
      });

    it('should invoke the AWS S3 SDK to delete the email object',
      function(done) {
        var data = {
          config: {
            emailBucket: "bucket",
            emailKeyPrefix: "prefix/",
            emailCleanupOnS3: true
          },
          context: {},
          email: {
            messageId: "abc"
          },
          log: console.log,
          s3: {
            deleteObject: function(options, callback) {
              callback(null);
            }
          }
        };
        index.emailCleanupOnS3(data)
          .then(function() {
            assert.ok(true, "emailCleanupOnS3 returned successfully");
            done();
          });
      });

    it('should result in failure if the AWS S3 SDK cannot delete the object',
      function(done) {
        var data = {
          config: {
            emailBucket: "bucket",
            emailKeyPrefix: "prefix/",
            emailCleanupOnS3: true
          },
          context: {},
          email: {
            messageId: "abc"
          },
          log: console.log,
          s3: {
            deleteObject: function(options, callback) {
              callback(true);
            }
          }
        };
        index.emailCleanupOnS3(data)
          .catch(function(err) {
            assert.ok(err, "emailCleanupOnS3 aborted operation");
            done();
          });
      });
  });
});
