// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const TestSequencer = require('@jest/test-sequencer').default;
const path = require('path');
const { getConfig } = require('./util');

const config = getConfig();
const includes = Array.isArray(config.include) ? config.include : [];
const excludes = Array.isArray(config.exclude) ? config.exclude : [];

class CustomSequencer extends TestSequencer {
  sort(tests) {
    if (includes.length > 0) {
      return tests.filter(test => {
        const basename = path.basename(test.path).toLowerCase();
        for (let include of includes) {
          const lcInclude = include.toLowerCase();
          if (basename === `${lcInclude}.test.ts` || basename === lcInclude) {
            return true;
          }
        }

        return false;
      });
    } else if (excludes.length > 0) {
      return tests.filter(test => {
        const basename = path.basename(test.path).toLowerCase();
        for (let exclude of excludes) {
          const lcExclude = exclude.toLowerCase();
          if (basename === `${lcExclude}.test.ts` || basename === lcExclude) {
            return false;
          }
        }

        return true;
      });
    }

    return tests;
  }
}

module.exports = CustomSequencer;
