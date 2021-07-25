// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const { saveLogsToFile } = require('./util');

module.exports = async function () {
  await global.__BROWSER_GLOBAL__.close();

  saveLogsToFile('jest-logs.json');
};
