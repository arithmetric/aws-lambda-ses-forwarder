
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
          log: console.log,
          s3: {
            copyObject: function(options, callback) {
              callback(null);
            },
            getObject: function(options, callback) {
              callback(null, {Body: "email data"});
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
            copyObject: function(options, callback) {
              callback(true);
            },
            getObject: function(options, callback) {
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
            copyObject: function(options, callback) {
              callback(null);
            },
            getObject: function(options, callback) {
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
    
    it('should enable smtp error 552',
      function(done) {
        var data = {
          config: {
            notifyEmail: "MAILER-DAEMON@example.com",
            notify552: true,
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
            copyObject: function(options, callback) {
              callback(null);
            },
            getObject: function(options, callback) {
              callback(null, {Body: "email data", ContentLength: 20000000});
            }
          }
        };
        index.fetchMessage(data)
          .then(function(data) {
            assert.equal(data.smtpErr,
              "552",
              "fetchMessage returned email data");
            done();
          });
      });
    
    it('should fail due to mail size exceeds 10MB',
      function(done) {
        var data = {
          config: {
            notifyEmail: "MAILER-DAEMON@example.com",
            notify552: false,
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
            copyObject: function(options, callback) {
              callback(null);
            },
            getObject: function(options, callback) {
              callback(null, {Body: "email data", ContentLength: 20000000});
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
