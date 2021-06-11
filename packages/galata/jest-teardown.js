// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const { getConfig, saveLogsToFile } = require('./util');

const config = getConfig();

module.exports = async function () {
  if (config.browserUrl === '') {
    await global.__BROWSER_GLOBAL__.close();
  }

  saveLogsToFile('jest-logs.json');
};
