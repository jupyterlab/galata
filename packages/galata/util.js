// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const fs = require('fs-extra');
const chalk = require('chalk');
const path = require('path');

const configKeys = {
  string: new Set([
    'browserType',
    'browserPath',
    'browserUrl',
    'jlabBaseUrl',
    'jlabToken',
    'testId',
    'testOutputDir',
    'referenceDir',
    'theme'
  ]),
  boolean: new Set([
    'headless',
    'skipVisualRegression',
    'skipHtmlRegression',
    'discardMatchedCaptures'
  ]),
  int: new Set(['pageWidth', 'pageHeight', 'slowMo']),
  float: new Set(['imageMatchThreshold']),
  custom: new Set(['include', 'exclude'])
};

function getConfig() {
  const config = {};

  function setConfigFromArg(key, value) {
    try {
      let keyValueType = '';
      for (let [valueType, keys] of Object.entries(configKeys)) {
        if (keys.has(key)) {
          keyValueType = valueType;
          break;
        }
      }

      switch (keyValueType) {
        case 'string':
          config[key] = value;
          break;
        case 'boolean':
          config[key] = value.toLowerCase() === 'true';
          break;
        case 'int':
          config[key] = parseInt(value);
          break;
        case 'float':
          config[key] = parseFloat(value);
          break;
        case 'custom':
          switch (key) {
            case 'include':
            case 'exclude':
              config[key] = JSON.parse(value).filter(suite => suite !== '');
          }
          break;
      }
    } catch (error) {
      console.error('Failed to parse argument', error);
    }
  }

  const numArgs = process.argv.length;
  for (let i = 2; i < numArgs; ++i) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const parts = arg.split('=');
      if (parts.length === 2) {
        const key = parts[0].substring(2);
        setConfigFromArg(key, parts[1]);
      }
    }
  }

  return config;
}

function log(type, message, options = { save: true }) {
  if (options.save) {
    if (global.__LOGS__ === undefined) {
      global.__LOGS__ = [];
    }

    global.__LOGS__.push({ type: type, message: message });
  }

  const color =
    type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'cyan';
  console.log(chalk.bold.bgWhite.black(' LOG '), chalk`{${color} ${message}}`);
}

function getLogs() {
  return global.__LOGS__ || [];
}

function getTestOutputDir() {
  const config = getConfig();
  return config.testOutputDir || process.testOutputDir;
}

function saveLogsToFile(fileName) {
  const testOutputDir = getTestOutputDir();
  const filePath = path.join(testOutputDir, fileName);
  fs.writeJsonSync(filePath, getLogs());
}

function getSavedLogs(fileName) {
  const testOutputDir = getTestOutputDir();
  const filePath = path.join(testOutputDir, fileName);

  let logs = [];
  try {
    logs = fs.readJsonSync(filePath);
  } catch (reason) {
    console.error(reason);
  }

  return logs;
}

function saveSessionInfo(sessionInfo) {
  const testOutputDir = getTestOutputDir();
  fs.writeJsonSync(path.join(testOutputDir, 'session.json'), sessionInfo);
}

function getSessionInfo() {
  const testOutputDir = getTestOutputDir();
  const filePath = path.join(testOutputDir, 'session.json');

  let sessionInfo = {};
  try {
    sessionInfo = fs.readJsonSync(filePath);
  } catch (reason) {
    console.error(reason);
  }

  return sessionInfo;
}

async function waitForDuration(duration) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

module.exports = {
  getConfig,
  saveSessionInfo,
  getSessionInfo,
  log,
  getLogs,
  saveLogsToFile,
  getSavedLogs,
  waitForDuration
};
