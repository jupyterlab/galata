// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const NodeEnvironment = require('jest-environment-node');
const fs = require('fs-extra');
const path = require('path');
const playwright = require('playwright');
const semver = require('semver');
const { v4: uuidv4 } = require('uuid');
const { getConfig, log, saveLogsToFile, getSessionInfo, saveSessionInfo, waitForDuration } = require('./util');


const sessionInfo = getSessionInfo();
const config = getConfig();
const browserType = config.browserType;
const pwBrowser = browserType === 'firefox' ? playwright.firefox :
                    browserType === 'webkit' ? playwright.webkit : playwright.chromium;

async function logAndExit(type, message, code = 1) {
    log(type, message);
    saveLogsToFile('jest-logs.json');

    // wait for stdio to flush so that logs are visible on console
    await waitForDuration(1000);

    process.exit(code);
}

async function checkJupyterLabVersion(page) {
    const buildJlabVersion = sessionInfo.buildJlabVersion;

    const runtimeJlabVersion = await page.evaluate(async () => {
        return window.galataip.app.version;
    });

    if (semver.valid(runtimeJlabVersion, true)) {
        const type = semver.major(runtimeJlabVersion, true) !== semver.major(buildJlabVersion, true) ? 'error' :
            semver.minor(runtimeJlabVersion, true) !== semver.minor(buildJlabVersion, true) ? 'warning' : '';

        if (type === 'error' || type === 'warning') {
            log(type, `Run-time JupyterLab version (${runtimeJlabVersion}) is different than testing framework is built for (${buildJlabVersion}). This could cause issues in testing.`);
        }
    } else {
        log('error', 'Failed to detect run-time JupyterLab version');
    }
    sessionInfo.runtimeJlabVersion = runtimeJlabVersion;

    saveSessionInfo(sessionInfo);
};

class TestEnvironment extends NodeEnvironment {
    constructor(config) {
        super(config);
    }

    /*
    * Wait for window.jupyterlab object to be available or until maxWait
    */
    async waitForJupyterLabAppObject(maxWait = 5000) {
        const context = this.global.__TEST_CONTEXT__;
        const checkPeriod = 200;

        return new Promise((resolve) => {
            const maxWaitTimeout = setTimeout(() => { resolve(); }, maxWait);
            const checkInterval = setInterval(async () => {
                const jupyterlabDefined = await context.page.evaluate(() => {
                    return typeof window.jupyterlab === 'object';
                });

                if (jupyterlabDefined) {
                    clearTimeout(maxWaitTimeout);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, checkPeriod);
        });
    }

    async openJLab() {
        const context = this.global.__TEST_CONTEXT__;
        try {
            await context.page.goto(context.jlabUrl, {
                waitUntil: 'domcontentloaded',
            });
            await this.waitForJupyterLabAppObject();
        } catch (error) {
            await logAndExit('error', `Failed to connect to JupyterLab URL "${context.jlabUrl}". Error message: ${error}`);
        }
    }

    async hookUp() {
        const context = this.global.__TEST_CONTEXT__;
        await context.page.addScriptTag({ path: path.resolve(__dirname, './lib-inpage/inpage.js') });

        const galataipDefined = await context.page.evaluate(async () => {
            return typeof window.galataip === 'object';
        });

        if (!galataipDefined) {
            await logAndExit('error', 'Failed to inject galataip object into browser context');
        }

        const jlabAccessible = await context.page.evaluate(async () => {
            return typeof window.galataip.app === 'object';
        });

        if (!jlabAccessible) {
            await logAndExit('error', 'Failed to access JupyterLab object in browser context');
        }

        let resourcePath = '/lab';
        if (context.jlabWorkspace) {
            resourcePath = `${resourcePath}/workspaces/${context.jlabWorkspace}`;
        }
        await context.page.evaluate(async (resourcePath) => {
            await window.galataip.waitForLaunch(resourcePath);
        }, resourcePath);

        if (!sessionInfo.runtimeJlabVersion) {
            await checkJupyterLabVersion(context.page);
        }

        if (config.theme !== '') {
            const themeName = config.theme === 'dark' ? 'JupyterLab Dark' :
                config.theme === 'light' ? 'JupyterLab Light' : config.theme;

            log('info', `Setting theme to ${themeName}`, { save: false });

            await context.page.evaluate(async (themeName) => {
                await window.galataip.setTheme(themeName);
            }, themeName);
        }
    }

    async createNewPage(options) {
        const context = this.global.__TEST_CONTEXT__;
        if (context.page) {
            context.page.close().catch(() => {}); // do it async
            context.page = null; 
        }

        const baseUrl = sessionInfo.jlabBaseUrl;
        let jlabUrl = path.join(baseUrl, 'lab');
        context.jlabWorkspace = '';

        if (options && options.generateWorkspace) {
            context.jlabWorkspace = uuidv4();
            jlabUrl = path.join(jlabUrl, 'workspaces', context.jlabWorkspace);
        }
        if (sessionInfo.jlabToken) {
            jlabUrl += `?token=${sessionInfo.jlabToken}`;
        }
        context.jlabUrl = jlabUrl;

        context.page = await context.browser.newPage();
        if (options && options.onPageCreated) {
            await Promise.resolve(options.onPageCreated(context.page));
        }

        await context.page.setViewportSize({
            width: config.pageWidth,
            height: config.pageHeight
        });

        await this.openJLab();
        await this.hookUp();

        if (options && options.onPageLoaded) {
            await Promise.resolve(options.onPageLoaded(context.page));
        }

        return context.page;
    }

    async reloadPage() {
        await this.openJLab();
        await this.hookUp();
    }

    async setup() {
        await super.setup();

        let browser;

        try {
            browser = await pwBrowser.connect({
                wsEndpoint: sessionInfo.wsEndpoint
            });
        } catch {
            const message = `Failed to connect to browser using wsEndpoint ${sessionInfo.wsEndpoint}`;
            log('error', message);
            saveLogsToFile('jest-logs.json');
            throw new Error(message);
        }

        this.global.__TEST_CONTEXT__ = {
            id: sessionInfo.id,
            testOutputDir: sessionInfo.testOutputDir,
            jlabBaseUrl: sessionInfo.jlabBaseUrl,
            jlabToken: sessionInfo.jlabToken,
            skipVisualRegression: sessionInfo.skipVisualRegression,
            skipHtmlRegression: sessionInfo.skipHtmlRegression,
            discardMatchedCaptures: sessionInfo.discardMatchedCaptures,
            referenceDir: sessionInfo.referenceDir,
            screenshotPrefix: '',
            browser: browser,
            exposedFunctions: ['screenshot'],
            testCaptures: {},
            testLogs: {},
            imageMatchThreshold: sessionInfo.imageMatchThreshold,
            _createNewPage: this.createNewPage.bind(this),
            _reloadPage: this.reloadPage.bind(this)
        };
        await this.createNewPage({ generateWorkspace: true });
    }

    async teardown() {
        const filePath = path.join(sessionInfo.testOutputDir, 'galata-output.json');
        let data = { captures: {}, logs: {} };
        if (fs.existsSync(filePath)) {
            try {
                data = JSON.parse(fs.readFileSync(filePath));
            } catch (error) {
                console.error('Failed to parse existing output data', error);
            }
        }
        data = {
            ...data,
            ...{
                captures: {
                    ...data.captures, ...this.global.__TEST_CONTEXT__.testCaptures
                },
                logs: {
                    ...data.logs, ...this.global.__TEST_CONTEXT__.testLogs
                }
            }
        };
        fs.writeFileSync(filePath, JSON.stringify(data));

        if (this.global.__TEST_CONTEXT__.page) {
            await this.global.__TEST_CONTEXT__.page.close();
        }
        await this.global.__TEST_CONTEXT__.browser.close();

        await super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = TestEnvironment;
