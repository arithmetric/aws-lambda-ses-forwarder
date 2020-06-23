
/* global describe, it */

let assert = require("assert");

require("../index");

describe('index.js', function() {
  describe('#Promise.settle()', function() {
    it('should fulfill on empty array',
      function(done) {
        let promises = [];
        Promise.settle(promises)
          .then(function(values) {
            assert.equal(values.length,
              0,
              "Promise.settle fulfills on empty array");
            done();
          });
      });

    it('should fulfill on invalid array',
        function(done) {
          let promises = ['invalid'];
          Promise.settle(promises)
          .then(function(values) {
            assert.equal(values.length,
                0,
                "Promise.settle fulfills on invalid array");
            done();
          });
        });

    it('should fulfill with rejected items',
        function(done) {
          let promises = [Promise.reject()];
          Promise.settle(promises)
          .then(function(values) {
            assert.strictEqual(values[0],
                undefined,
                "Promise.settle 1/2 fulfills with rejected items");
            assert.equal(values.length,
                1,
                "Promise.settle 2/2 fulfills with rejected items");
            done();
          });
        });
  });
});
