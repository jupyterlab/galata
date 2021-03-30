#! /usr/bin/env node

// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const meow = require('meow');
const spawn = require('cross-spawn');
const open = require('open');
const ejs = require('ejs');
const fs = require('fs-extra');
const path = require('path');
const dateformat = require('dateformat');
const AnsiUp = require('ansi_up').default;
const inquirer = require('inquirer');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { getSessionInfo, log, getLogs, getSavedLogs } = require('../util');
const selfDir = path.resolve(__dirname);
const cwd = process.cwd();

const configFileData = fs.existsSync('./galata-config.json') ? fs.readFileSync('./galata-config.json') : undefined;
let config = configFileData ? JSON.parse(configFileData) : {};
let testOutputDir, jestOutputPath;

const DEFAULT_JLAB_BASE_URL = 'http://localhost:8888';
const DEFAULT_PAGE_WIDTH = 1024;
const DEFAULT_PAGE_HEIGHT = 768;
const startTime = new Date();

const cli = meow(`
    Usage
      $ galata <test_files> <options>

    Options
      --browser-type              Browser type to use [chromium (default), firefox, webkit]
      --browser-path              Browser executable path
      --browser-url               Browser remote debugging URL
      --test-path-pattern         regexp pattern to match test files
      --jlab-base-url             JupyterLab base URL
      --jlab-token                JupyterLab authentication token
      --jest-config               jest configuration file
      --jest-path                 jest executable path
      --headless                  flag to enable browser headless mode
      --page-width                browser page width
      --page-height               browser page height
      --include                   suites to include
      --exclude                   suites to exclude
      --skip-visual-regression    flag to skip visual regression tests
      --skip-html-regression      flag to skip HTML regression tests
      --discard-matched-captures  delete test captures when matching with reference
      --output-dir                result output directory
      --test-id                   custom test id
      --reference-dir             reference output directory
      --result-server             launch result file server when tests finished
      --open-report               open result report
      --image-match-threshold     image matching threshold
      --slow-mo                   slow down UI operations by the specified ms

    Other options:
      --launch-result-server      launch result file server for a test
      --update-references         update reference files from a test's output
      --delete-references         flag to delete all reference files
      --help                      show usage information
      --version                   show version information

    Examples
      $ galata --jlab-base-url http://localhost:8888
      $ galata --browser-url http://localhost:9222 --jlab-base-url http://localhost:8888
      $ galata ./ui-tests/*.test.ts
      $ galata --exclude contents
      $ galata --include [notebook,contents]
      $ galata --launch-result-server
`, {
    flags: {
        jlabBaseUrl: {
            type: 'string',
            default: config.jlabBaseUrl || DEFAULT_JLAB_BASE_URL
        },
        jlabToken: {
            type: 'string',
            default: config.jlabToken || ""
        },
        headless: {
            type: 'boolean',
            default: config.headless !== false
        },
        pageWidth: {
            type: 'number',
            default: config.pageWidth || DEFAULT_PAGE_WIDTH
        },
        pageHeight: {
            type: 'number',
            default: config.pageHeight || DEFAULT_PAGE_HEIGHT
        },
        include: {
            type: 'string',
            default: config.include ? JSON.stringify(config.include).replace(/\"/g, "") : '[]'
        },
        exclude: {
            type: 'string',
            default: config.exclude ? JSON.stringify(config.exclude).replace(/\"/g, "") : '[]'
        },
        skipVisualRegression: {
            type: 'boolean',
            default: config.skipVisualRegression === true
        },
        skipHtmlRegression: {
            type: 'boolean',
            default: config.skipHtmlRegression === true
        },
        outputDir: {
            type: 'string',
            default: config.outputDir || './test-output'
        },
        testId: {
            type: 'string',
            default: config.testId || dateformat(new Date(), "yyyy-mm-dd_HH-MM-ss")
        },
        referenceDir: {
            type: 'string',
            default: config.referenceDir || './reference-output'
        },
        resultServer: {
            type: 'boolean',
            default: false
        },
        launchResultServer: {
            type: 'string',
            default: 'latest'
        },
        openReport: {
            type: 'boolean',
            default: true
        },
        slowMo: {
            type: 'number',
            default: 0
        },
        imageMatchThreshold: {
            type: 'number',
            default: 0.1
        },
        browserType: {
            type: 'string',
            default: 'chromium'
        },
        browserPath: {
            type: 'string',
            default: config.browserPath || ''
        },
        browserUrl: {
            type: 'string',
            default: config.browserUrl || ''
        },
        deleteReferences: {
            type: 'boolean',
            default: false
        },
        updateReferences: {
            type: 'string',
            default: ''
        },
        jestConfig: {
            type: 'string',
            default: config.jestConfig || ''
        },
        testPathPattern: {
            type: 'string',
            default: config.testPathPattern || '^.*/tests/.*[ts,js]$'
        },
        discardMatchedCaptures: {
            type: 'boolean',
            default: config.discardMatchedCaptures !== false
        },
        jestPath: {
            type: 'string',
             // inside node_modules of client
            default: config.jestPath || './node_modules/.bin/jest'
        }
    }
});

function argumentExists(argName) {
    argName = `--${argName}`;
    const argNameAssignment = `--${argName}=`;

    for (let arg of process.argv) {
        if (arg === argName || arg.startsWith(argNameAssignment)) {
            return true;
        }
    }

    return false;
}

if (argumentExists('launch-result-server')) {
    if (cli.flags.launchResultServer.trim() === '') {
        cli.flags.launchResultServer = 'latest';
    }
} else {
    cli.flags.launchResultServer = '';
}

if (argumentExists('update-references')) {
    if (cli.flags.updateReferences.trim() === '') {
        cli.flags.updateReferences = 'latest';
    }
} else {
    cli.flags.updateReferences = '';
}

if (cli.input.length > 0) {
    delete cli.flags.testPathPattern;
}

function parseStringArray(input) {
    if (!(typeof input === 'string')) {
        return [];
    }

    if (!(input.startsWith('[') && input.endsWith(']'))) {
        input = `[${input}]`;
    }

    const values = input.substring(1, input.length - 1).split(',');

    return values.map(value => value.trim());
}

function getLatestRunTest() {
    const outputDir = cli.flags.outputDir;
    let testDirectories = fs.readdirSync(outputDir, { withFileTypes: true });
    testDirectories = testDirectories.filter((item) => item.isDirectory());

    if (testDirectories.length === 0) {
        return;
    }

    testDirectories = testDirectories.sort((lhs, rhs) => rhs.name.localeCompare(lhs.name));

    return testDirectories[0].name;
}

function getSessionLogs() {
    const jestLogs = getSavedLogs('jest-logs.json');
    const cliLogs = getLogs();

    return [...jestLogs, ...cliLogs];
}

function generateHTMLReport(testId) {
    const sessionInfo = getSessionInfo();

    let data = {
        startTime: startTime.getTime(),
        galata: {
            testId: testId,
            jlabUrl: sessionInfo.jlabBaseUrl,
            buildJlabVersion: sessionInfo.buildJlabVersion,
            runtimeJlabVersion: sessionInfo.runtimeJlabVersion,
            discardMatchedCaptures: sessionInfo.discardMatchedCaptures
        },
        testResults: []
    };

    if (fs.existsSync(jestOutputPath)) {
        try {
            const jestOutput = fs.readJsonSync(jestOutputPath);
            data = { ...data, ...jestOutput };
        } catch {
            log('error', 'Failed to parse jest output');
        }
    } else {
        log('error', 'jest output not found');
    }

    const galataOutputPath = path.join(testOutputDir, 'galata-output.json');

    if (fs.existsSync(galataOutputPath)) {
        let galataOutput;
        try {
            galataOutput = fs.readJsonSync(galataOutputPath);
            data = { ...data, ...galataOutput };
        } catch {
            log('error', 'Failed to parse galata output');
        }

        if (galataOutput) {
            const captures = galataOutput['captures'];
            const logs = galataOutput['logs'];
            const ansiUp = new AnsiUp();
            let testsBasePath = cwd;
            testsBasePath = path.normalize(path.join(testsBasePath, '/')).replace(/\\/g, "\\\\");
            const re = new RegExp(testsBasePath, 'g');

            const referenceSrcDir = path.resolve(cwd, cli.flags.referenceDir);
            const referenceDstDir = `${testOutputDir}/reference-output`;

            data.galata = {...data.galata, ...{ logs: getSessionLogs() }};

            data.testResults.forEach((testResult) => {
                // convert to relative path
                testResult.name = testResult.name.replace(re, '');
                if (testResult.assertionResults.length > 0) {
                    const suiteName = testResult.assertionResults[0].ancestorTitles[0];
                    testResult.assertionResults.forEach((ar) => {
                        if (ar.status !== 'passed') {
                            const numMessages = ar.failureMessages.length;
                            for (let m = 0; m < numMessages; ++m) {
                                let message = ar.failureMessages[m];
                                // convert to relative path
                                message = message.replace(re, '');
                                ar.failureMessages[m] = ansiUp.ansi_to_html(message);
                            }
                        }
                        const testName = ar.title;
                        if (captures[suiteName]) {
                            ar.captures = captures[suiteName][testName];
                            if (Array.isArray(ar.captures)) {
                                for (const c of ar.captures) {
                                    // if there was a diff, copy reference to test output directory
                                    if (c.result !== 'same') {
                                        let typeDir, ext;
                                        if (c.type === 'image') {
                                            typeDir = 'screenshots';
                                            ext = 'png';
                                        } else {
                                            typeDir = 'html';
                                            ext = 'html';
                                        }
                                        const fileName = `${c.fileName}.${ext}`;
                                        const srcFilePath = path.join(referenceSrcDir, typeDir, fileName);
                                        const dstFilePath = path.join(referenceDstDir, typeDir, fileName);
                                        if (fs.existsSync(srcFilePath)) {
                                            fs.copyFileSync(srcFilePath, dstFilePath);
                                        }
                                    }
                                }
                            }
                        }
                        if (logs[suiteName]) {
                            ar.logs = logs[suiteName][testName];
                        }
                    });
                }
            });
        }
    } else {
        log('error', 'galata output not found');
        data.galata = {...data.galata, ...{ logs: getSessionLogs() }};
    }

    fs.copySync(path.resolve(__dirname, '../static'), `${testOutputDir}/report`);

    const template = fs.readFileSync(path.resolve(__dirname, '../report.ejs'), 'utf-8');
    const html = ejs.render(template, { data: data });

    fs.writeFileSync(path.join(testOutputDir, 'report/index.html'), html);
}

function launchResultServer(testId) {
    const httpServerPath = getHttpServerPath();
    if (!httpServerPath) {
        log('error', 'http-server executable not found');
        process.exit(1);
    }

    const port = '8080';
    const outputDir = cli.flags.outputDir;

    if (testId === 'latest') {
        testId = getLatestRunTest();

        if (!testId) {
            console.log(`No test output found in directory '${outputDir}'.`);
            process.exit(1);
        }
    }

    const testOutputDir = path.join(outputDir, testId);

    spawn(httpServerPath, [testOutputDir, '-p', port, '-c-1'], {
        stdio: [process.stdin, process.stdout, process.stderr]
    });

    if (cli.flags.openReport) {
        open(`http://127.0.0.1:${port}/report/index.html`);
    }
}

function getFileListSync(dir, filelist) {
    filelist = filelist || [];
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = getFileListSync(path.join(dir, file), filelist);
        } else {
            filelist.push(path.join(dir, file));
        }
    });

    return filelist;
}

function runDeleteReferenceFiles() {
    let fileList = [];
    const referenceDir = cli.flags.referenceDir;
    if (fs.existsSync(referenceDir)) {
        fileList = getFileListSync(referenceDir);
    } else {
        console.log(`Reference directory '${referenceDir}' does not exist.`);
        process.exit(1);
    }

    if (fileList.length === 0) {
        console.log(`Reference directory '${referenceDir}' is empty.`);
        process.exit(1);
    }

    console.log('Files to delete:\n----------------');
    fileList.forEach((file) => {
        console.log(file);
    });

    inquirer.prompt({
        message: `Are you sure you want to delete ${fileList.length} reference files?`,
        type: "confirm",
        name: "delete",
        default: false
    }).then((answer) => {
        if (answer.delete) {
            console.log('Deleting reference files...');
            fs.emptyDirSync(referenceDir);
        } else {
            console.log('Cancelled deleting reference files.');
        }

        process.exit(0);
    });
}

function runUpdateReferenceFiles() {
    const outputDir = cli.flags.outputDir;
    const referenceDir = cli.flags.referenceDir;

    if (!fs.existsSync(outputDir)) {
        console.log(`Output directory ${outputDir} not found, creating it`);
        fs.mkdirSync(outputDir, { recursive: true });
    }

    if (!fs.existsSync(referenceDir)) {
        console.log(`Reference directory ${referenceDir} not found, creating it`);
        fs.mkdirSync(referenceDir, { recursive: true });
    }

    let testId = cli.flags.updateReferences;
    if (testId === 'latest') {
        testId = getLatestRunTest();

        if (!testId) {
            console.log(`No test output found in directory '${outputDir}'.`);
            process.exit(1);
        }
    }

    const testOutputDir = path.join(outputDir, testId);

    if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir, { recursive: true });
    }

    console.log(`Copying test output files from ${testOutputDir} into reference directory ${referenceDir}`);

    const referenceScreenshotsDir = path.join(referenceDir, 'screenshots');
    const referenceHtmlDir = path.join(referenceDir, 'html');

    const screenshotsOutputDir = path.join(testOutputDir, 'screenshots');
    let screenshots = fs.readdirSync(screenshotsOutputDir, { withFileTypes: true });
    screenshots = screenshots.filter((item) => item.isFile() && item.name.endsWith('.png'));
    const numScreenshots = screenshots.length;
    if (numScreenshots > 0) {
        screenshots.forEach((screenshot) => {
            fs.ensureDirSync(path.join(referenceScreenshotsDir, path.dirname(screenshot.name)));
            fs.copyFileSync(path.join(screenshotsOutputDir, screenshot.name), path.join(referenceScreenshotsDir, path.basename(screenshot.name)));
        });
    }
    console.log(`${numScreenshots} screenshots copied to reference directory`);

    const htmlOutputDir = path.join(testOutputDir, 'html');
    let htmlFiles = fs.readdirSync(htmlOutputDir, { withFileTypes: true });
    htmlFiles = htmlFiles.filter((item) => item.isFile() && item.name.endsWith('.html'));
    const numHtmlFiles = htmlFiles.length;
    if (numHtmlFiles > 0) {
        htmlFiles.forEach((htmlFile) => {
            fs.ensureDirSync(path.join(referenceHtmlDir, path.dirname(htmlFile.name)));
            fs.copyFileSync(path.join(htmlOutputDir, htmlFile.name), path.join(referenceHtmlDir, path.basename(htmlFile.name)));
        });
    }
    console.log(`${numHtmlFiles} HTML files copied to reference directory`);

    process.exit(0);
}

function getCLIScriptPath(scriptName, scriptDir, maxDepth = 10) {
    if (scriptDir === undefined) {
        scriptDir = './node_modules/.bin';
    } else {
        scriptDir = path.join('../', scriptDir).normalize();
    }

    const scriptPath = path.join(scriptDir, scriptName);

    if (fs.existsSync(scriptPath)) {
        return scriptPath;
    } else {
        if (maxDepth === 0) {
            // check under Galata package installation
            const scriptDirUnderGalata = path.join(selfDir, '../node_modules', scriptName, 'bin').normalize();
            if (fs.existsSync(scriptDirUnderGalata)) {
                const binaryExecutable = path.join(scriptDirUnderGalata, scriptName);
                if (fs.existsSync(binaryExecutable)) {
                    return binaryExecutable;
                }
                const jsExecutable = path.join(scriptDirUnderGalata, `${scriptName}.js`);
                if (fs.existsSync(jsExecutable)) {
                    return jsExecutable;
                }
            }
            return undefined;
        } else {
            return getCLIScriptPath(scriptName, scriptDir, --maxDepth);
        }
    }
}

function getJestPath() {
    if (fs.existsSync(cli.flags.jestPath)) {
        return cli.flags.jestPath;
    }

    return getCLIScriptPath('jest');
}

function getJestConfigPath() {
    if (cli.flags.jestConfig !== '') {
        return { path: cli.flags.jestConfig, temp: false };
    }

    // create a temporary config file at CWD
    const tmpConfigPath = path.join(cwd, `${uuidv4()}.js`);
    const configUnderGalata = path.join(selfDir, '../jest.config.js').normalize();
    // jest expects relative path
    let configRelative = path.relative(cwd, configUnderGalata);
    if (!configRelative.startsWith('.')) {
        configRelative = `./${configRelative}`;
    }
    const content = `
    module.exports = {
        preset: '${configRelative}'
    };
    `;
    fs.writeFileSync(tmpConfigPath, content);
    return { path: tmpConfigPath, temp: true };
}

function getHttpServerPath() {
    return getCLIScriptPath('http-server');
}

function runTests() {
    const outputDir = cli.flags.outputDir;
    const flagsArray = [];
    const appOnlyKeys = new Set(['jestConfig', 'resultServer', 'launchResultServer', 'deleteReferences', 'updateReferences', 'jestPath']);

    Object.keys(cli.flags).forEach((key) => {
        if (!appOnlyKeys.has(key)) {
            let value = cli.flags[key];
            if (key === 'include' || key === 'exclude') {
                value = JSON.stringify(parseStringArray(cli.flags[key]));
            }
            flagsArray.push(`--${key}=${value}`);
        }
    });

    const testId = cli.flags.testId;
    testOutputDir = path.join(outputDir, testId);
    process.testOutputDir = testOutputDir;
    jestOutputPath = `${testOutputDir}/jest-output.json`;

    if (fs.existsSync(testOutputDir)) {
        log('info', `Deleting existing test output directory '${testId}'`, { save: false });
        fs.removeSync(testOutputDir);
    }
    fs.mkdirSync(testOutputDir, { recursive: true });
    fs.mkdirSync(`${testOutputDir}/screenshots/diff`, { recursive: true });
    fs.mkdirSync(`${testOutputDir}/html/diff`, { recursive: true });
    fs.mkdirSync(`${testOutputDir}/reference-output/screenshots`, { recursive: true });
    fs.mkdirSync(`${testOutputDir}/reference-output/html`, { recursive: true });

    flagsArray.push(`--testId=${testId}`);
    flagsArray.push(`--testOutputDir=${testOutputDir}`);

    const jestPath = getJestPath();
    if (!jestPath) {
        log('error', 'jest executable not found');
        process.exit(1);
    }
    const jestDefaults = ['--verbose', '--runInBand', '--json', `--outputFile=${jestOutputPath}`];
    const jestConfig = getJestConfigPath();

    if (jestConfig.path !== '') {
        jestDefaults.push('--config', jestConfig.path);
    }

    const run = spawn.sync(jestPath, [...cli.input, ...jestDefaults, ...flagsArray], {
        stdio: [process.stdin, process.stdout, process.stderr]
    });

    if (jestConfig.temp) {
        fs.unlinkSync(jestConfig.path);
    }

    generateHTMLReport(testId);

    if (cli.flags.resultServer) {
        launchResultServer(testId);
    } else {
        process.exit(run.status === null ? 9999 : run.status);
    }
}

if (cli.flags.updateReferences !== '') {
    runUpdateReferenceFiles();
} else if (cli.flags.deleteReferences) {
    runDeleteReferenceFiles();
} else if (cli.flags.launchResultServer !== '') {
    launchResultServer(cli.flags.launchResultServer);
} else {
    runTests();
}
