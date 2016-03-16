
/* global describe, it */

var assert = require("assert");

var index = require("../index");

describe('index.js', function() {
  describe('#finish()', function() {
    it('should report a successful completion',
      function(done) {
        var data = {
          context: {
            succeed: function() {
              assert.ok(true, "finish reported success");
              done();
            }
          }
        };
        index.finish(data, function() {
          assert.ok(false, "finish reported success");
          done();
        });
      });
  });
});
