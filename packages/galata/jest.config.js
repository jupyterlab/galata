// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const path = require('path');

module.exports = {
  globalSetup: path.resolve(__dirname, './jest-setup.js'),
  globalTeardown: path.resolve(__dirname, './jest-teardown.js'),
  testEnvironment: path.resolve(__dirname, './jest-env.js'),
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },
  testSequencer: path.resolve(__dirname, './jest-sequencer.js')
};
