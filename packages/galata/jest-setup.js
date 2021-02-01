// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const semver = require('semver');
const { getConfig, log, saveLogsToFile, saveSessionInfo, waitForDuration } = require('./util');

const config = getConfig();

function getBuildJlabVersion() {
    const metadataFilePath = path.resolve(__dirname, './bin/metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataFilePath)) {
        try {
            metadata = fs.readJSONSync(metadataFilePath);
        } catch {
        }
    }

    const version = metadata['jlabVersion'];
    
    if (semver.valid(version)) {
        log('info', `Using Galata built for JupyterLab version ${version}`, { save: false });
    } else {
        log('error', 'Failed to detect build-time JupyterLab version');
    }
    return version;
}

async function logAndExit(type, message, code = 1) {
    log(type, message);
    saveLogsToFile('jest-logs.json');
    
    // wait for stdio to flush so that logs are visible on console
    await waitForDuration(1000);

    process.exit(code);
}

module.exports = async function () {
    // add a line break for first log to appear in new line
    console.log('\n');

    const pageWidth = config.pageWidth;
    const pageHeight = config.pageHeight;
    const headless = config.headless;
    const slowMo = config.slowMo;
    let browser;

    if (config.chromeUrl !== '') {
        try {
            const apiUrl = `${config.chromeUrl}/json/version`;
            const response = await axios.get(apiUrl);
            browser = await puppeteer.connect({
                browserWSEndpoint: response.data.webSocketDebuggerUrl,
                slowMo: slowMo
            });
        } catch {
            await logAndExit('error', `Failed to connect to remote Chrome at "${config.chromeUrl}"`);
        }
    } else {
        if (fs.existsSync(config.chromePath)) {
            try {
                browser = await puppeteer.launch({
                    executablePath: config.chromePath,
                    headless: headless,
                    args: ['-AppleMagnifiedMode', 'YES', `--window-size=${pageWidth},${pageHeight + 25}`],
                    ignoreDefaultArgs: ["--enable-automation"],
                    defaultViewport: {
                        width: pageWidth,
                        height: pageHeight,
                        deviceScaleFactor: 1
                    },
                    slowMo: slowMo
                });
            } catch {
                await logAndExit('error', `Failed to launch headless browser from "${config.chromePath}"`);
            }
        } else {
            await logAndExit('error', `Chrome executable not found at path "${config.chromePath}"`);
        }
    }

    // store the browser instance so we can teardown it later
    // this global is only available in the teardown but not in TestEnvironments
    global.__BROWSER_GLOBAL__ = browser;

    const sessionInfo = {
        testId: config.testId,
        chromePath: config.chromePath,
        testOutputDir: config.testOutputDir,
        referenceDir: config.referenceDir,
        jlabBaseUrl: config.jlabBaseUrl,
        jlabToken: config.jlabToken,
        skipVisualRegression: config.skipVisualRegression === true,
        skipHtmlRegression: config.skipHtmlRegression === true,
        discardMatchedCaptures: config.discardMatchedCaptures !== false,
        wsEndpoint: browser.wsEndpoint(),
        buildJlabVersion: getBuildJlabVersion(),
        imageMatchThreshold: config.imageMatchThreshold
    };

    saveSessionInfo(sessionInfo);
};
