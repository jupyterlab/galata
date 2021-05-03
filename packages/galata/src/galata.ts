// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { Page, ElementHandle } from 'playwright';

import {
    IDocumentManager
} from '@jupyterlab/docmanager';

import {
    ISettingRegistry
} from '@jupyterlab/settingregistry';

import {
    NotebookPanel
} from '@jupyterlab/notebook';

import * as nbformat from '@jupyterlab/nbformat';

import * as fs from 'fs';
import * as path from 'path';
import { default as axios, AxiosRequestConfig } from 'axios';
import pixelmatch from 'pixelmatch';
import * as jsBeautify from 'js-beautify';

import {
    PNG
} from 'pngjs';

import {
    INotebookRunCallback, IPluginNameToInterfaceMap, PLUGIN_ID_DOC_MANAGER, PLUGIN_ID_SETTINGS
} from './inpage/tokens';

import {
    IGalataContext, CaptureCompareResult, ICapture, ITestLog, ICreateNewPageOptions
} from './tokens';

let _runCallbacksExposed: number = 0;
let _currentSuite: string;
let _currentTest: string;

function describeWrapper(name: number | string | Function | jest.FunctionLike, fn: jest.EmptyFunction) {
    _currentSuite = name as string;

    return describe(name, fn);
}

function wrappedTestFn(suiteName: string, testName: string, fn?: jest.ProvidesCallback): jest.ProvidesCallback {
    const localTestName = testName;

    return async (cb: jest.DoneCallback) => {
        _currentTest = localTestName;

        await fn(cb);
        cb();
    };
}

function testWrapper(name: string, fn?: jest.ProvidesCallback, timeout?: number) {
    return test(name, wrappedTestFn(_currentSuite, name, fn), timeout);
}

export
namespace galata {
    function _base64EncodeFile(filePath: string) {
        const content = fs.readFileSync(filePath);
        return content.toString('base64');
    }

    function _transformCaptureName(fileName: string): string {
        if (context.capturePrefix !== '') {
            fileName = `${context.capturePrefix}_${fileName}`;
        }
        return fileName.toLowerCase().replace(/[^a-z0-9]+/gi, "_");
    }

    async function _getElementClassList(element: ElementHandle): Promise<string[]> {
        if (!element) {
            return [];
        }

        const className = await element.getProperty("className");
        if (className) {
            const classNameList = await className.jsonValue();
            if (typeof(classNameList) === 'string') {
                return classNameList.split(" ");
            }
        }

        return [];
    }

    export
    const context: IGalataContext = global.__TEST_CONTEXT__;

    export
    type SidebarPosition = 'left' | 'right';

    export
    type SidebarTabId = 'filebrowser' | 'jp-running-sessions' | 'tab-manager' | 'jp-property-inspector' | 'extensionmanager.main-view' | 'jp-debugger-sidebar';

    export
    function xpContainsClass(className: string): string {
        return `contains(concat(" ", normalize-space(@class), " "), " ${className} ")`;
    }

    export
    function xpBuildActivityTabSelector(name: string): string {
        return `//div[${xpContainsClass('jp-Activity')}]/ul/li[${xpContainsClass('lm-TabBar-tab')} and ./div[text()="${name}" and ${xpContainsClass('lm-TabBar-tabLabel')}]]`;
    }

    export
    function xpBuildActivityPanelSelector(id: string): string {
        return `//div[@id='${id}' and ${xpContainsClass('jp-Activity')} and ${xpContainsClass('lm-DockPanel-widget')}]`;
    }

    export
    function xpBuildActiveActivityTabSelector(): string {
        return `//div[${xpContainsClass('jp-Activity')}]/ul/li[${xpContainsClass('lm-TabBar-tab')} and ${xpContainsClass('lm-mod-current')} and ./div[${xpContainsClass('lm-TabBar-tabLabel')}]]`;
    }

    export
    function getFilesInDirectory(dirPath: string, filePaths?: string[]): string[] {
        const files = fs.readdirSync(dirPath);
    
        filePaths = filePaths || [];
    
        for (let file of files) {
            if (file.startsWith('.')) {
                continue;
            }
            if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                filePaths = getFilesInDirectory(dirPath + "/" + file, filePaths);
            } else {
                filePaths.push(path.join(dirPath, "/", file));
            }
        }
    
        return filePaths;
    }

    async function waitForFunction(fn: Function, timeout?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let checkTimer;
            let timeoutTimer;
            const check = async () => {
                checkTimer = null;
                if (await Promise.resolve(fn())) {
                    if (timeoutTimer) {
                        clearTimeout(timeoutTimer);
                    }
                    resolve();
                } else {
                    checkTimer = setTimeout(check, 200);
                }
            };

            check();

            if (timeout) {
                timeoutTimer = setTimeout(() => {
                    timeoutTimer = null;
                    if (checkTimer) {
                        clearTimeout(checkTimer);
                    }
                    reject(new Error('Timed out waiting for condition to be fulfilled.'));
                }, timeout);
            }
        });
    }

    async function waitForDuration(duration: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => { resolve(); }, duration);
        });
    }

    export
    async function waitFor(condition: Function | number, timeout?: number): Promise<void> {
        const conditionType = typeof condition;

        if (conditionType === 'function') {
            return waitForFunction(condition as Function, timeout);
        } else if (conditionType === 'number') {
            return waitForDuration(condition as number);
        }
    }

    function logTestCapture(capture: ICapture) {
        if (!context.testCaptures[_currentSuite]) {
            context.testCaptures[_currentSuite] = {};
        }
        const suiteCaptures = context.testCaptures[_currentSuite];
        if (!suiteCaptures[_currentTest]) {
            suiteCaptures[_currentTest] = [];
        }
        const testCaptures = suiteCaptures[_currentTest];
        const numCaptures = testCaptures.length;

        // if same name and type (html, image) then replace
        for (let c = 0; c < numCaptures; ++c) {
            const existingCapture = testCaptures[c];
            if (existingCapture.name === capture.name && capture.type === existingCapture.type) {
                testCaptures[c] = capture;
                return;
            }
        }

        testCaptures.push(capture);
    }

    export
    function log(log: ITestLog) {
        if (!context.testLogs[_currentSuite]) {
            context.testLogs[_currentSuite] = {};
        }
        const suiteLogs = context.testLogs[_currentSuite];
        if (!suiteLogs[_currentTest]) {
            suiteLogs[_currentTest] = [];
        }
        const testLogs = suiteLogs[_currentTest];

        testLogs.push(log);
    }

    export
    function createNewPage(options?: ICreateNewPageOptions): Promise<Page> {
        return context._createNewPage(options);
    }

    export
    async function reloadPage(): Promise<void> {
        await context._reloadPage();
    }

    export
    namespace capture {
        export
        async function screenshot(fileName: string, element: ElementHandle<Element> | null = null): Promise<boolean> {
            const fileNameSafe = _transformCaptureName(fileName);
            const filePath = `screenshots/${fileNameSafe}.png`;
            const options: any = {
                path: `${context.testOutputDir}/${filePath}`
            };
            const logScreenshot = () => {
                logTestCapture({type: 'image', name: fileName, fileName: fileNameSafe, result: 'uncompared'});
            };

            if (element) {
                const rect = await context.page.evaluate(async (element) => {
                    const rect = element.getBoundingClientRect();
                    return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
                }, element);
            
                if (rect.width > 0 && rect.height > 0) {
                    await element.screenshot(options);
                    logScreenshot();
                    return true;
                }
            } else {
                await context.page.screenshot(options);
                logScreenshot();
                return true;
            }

            return false;
        }

        export
        async function compareScreenshot(fileName: string): Promise<CaptureCompareResult> {
            const fileNameSafe = _transformCaptureName(fileName);
            const filePath = `screenshots/${fileNameSafe}.png`;
            const removeMatchedCapture = () => {
                if (context.discardMatchedCaptures) {
                    fs.unlinkSync(`${context.testOutputDir}/${filePath}`);
                }
            };

            if (context.skipVisualRegression) {
                return 'same';
            }

            const referencePath = `screenshots/${fileNameSafe}.png`;
            let result: CaptureCompareResult;

            if (!fs.existsSync(`${context.testOutputDir}/${filePath}`)) {
                result = 'missing-capture';
            }

            if (!fs.existsSync(`${context.referenceDir}/${referencePath}`)) {
                result = 'missing-reference';
            }

            if (result) {
                logTestCapture({
                    type: 'image',
                    name: fileName,
                    fileName: fileNameSafe,
                    result: result
                });
                return result;
            }

            const referenceImage = PNG.sync.read(fs.readFileSync(`${context.referenceDir}/${referencePath}`));
            const testImage = PNG.sync.read(fs.readFileSync(`${context.testOutputDir}/${filePath}`));
            const { width, height } = referenceImage;

            if (testImage.width !== width || testImage.height !== height) {
                result = 'different-size';
                logTestCapture({
                    type: 'image',
                    name: fileName,
                    fileName: fileNameSafe,
                    result: result
                });
                return result;
            }

            const threshold = context.imageMatchThreshold;
            const diffImage = new PNG({ width, height });
            let diff = 0;
            try {
                diff = pixelmatch(
                    referenceImage.data, testImage.data, diffImage.data, width, height, { threshold: threshold });
            } catch {
                diff = Number.MAX_SAFE_INTEGER;
            }
            if (diff > 0) {
                result = 'different';
                const diffPath = `screenshots/diff/${fileNameSafe}.png`;
                fs.writeFileSync(`${context.testOutputDir}/${diffPath}`, PNG.sync.write(diffImage));
            } else {
                result = 'same';
                removeMatchedCapture();
            }

            logTestCapture({
                type: 'image',
                name: fileName,
                fileName: fileNameSafe,
                result: result
            });

            return result;
        }

        export
        async function captureHTML(fileName: string, element: ElementHandle<Element> | null = null): Promise<string> {
            const fileNameSafe = _transformCaptureName(fileName);
            const filePath = `html/${fileNameSafe}.html`;
            logTestCapture({type: 'html', name: fileName, fileName: fileNameSafe, result: 'uncompared'});

            let result: string;

            if (element) {
                result = await element.evaluate(node => node.innerHTML);
            } else {
                result = await context.page.evaluate(() => document.body.innerHTML);
            }

            result = jsBeautify.html(result);

            fs.writeFileSync(`${context.testOutputDir}/${filePath}`, result);

            return result;
        }

        export
        async function compareHTML(fileName: string): Promise<CaptureCompareResult> {
            const fileNameSafe = _transformCaptureName(fileName);
            const filePath = `html/${fileNameSafe}.html`;
            const removeMatchedCapture = () => {
                if (context.discardMatchedCaptures) {
                    fs.unlinkSync(`${context.testOutputDir}/${filePath}`);
                }
            };

            if (context.skipHtmlRegression) {
                return 'same';
            }

            const referencePath = `html/${fileNameSafe}.html`;
            let result: CaptureCompareResult;

            if (!fs.existsSync(`${context.testOutputDir}/${filePath}`)) {
                result = 'missing-capture';
            }
            
            if (!fs.existsSync(`${context.referenceDir}/${referencePath}`)) {
                result = 'missing-reference';
            }

            if (result) {
                logTestCapture({
                    type: 'html',
                    name: fileName,
                    fileName: fileNameSafe,
                    result: result
                });
                return result;
            }

            const referenceContent = fs.readFileSync(`${context.referenceDir}/${referencePath}`);
            const testContent = fs.readFileSync(`${context.testOutputDir}/${filePath}`);
            if (testContent.compare(referenceContent) !== 0) {
                result = 'different';
                const diffPath = `${context.testOutputDir}/html/diff/${fileNameSafe}.html`;
                fs.writeFileSync(diffPath, 'different');
            } else {
                result = 'same';
                removeMatchedCapture();
            }

            logTestCapture({
                type: 'html',
                name: fileName,
                fileName: fileNameSafe,
                result: result
            });

            return result;
        }
    }

    export
    namespace kernel {
        export
        async function isAnyRunning(): Promise<boolean> {
            return await context.page.evaluate(() => {
                return window.jupyterlab.serviceManager.sessions.running().next() !== undefined;
            });
        }

        export
        async function shutdownAll(): Promise<void> {
            await context.page.evaluate(async () => {
                await window.jupyterlab.serviceManager.sessions.shutdownAll();
            });

            await waitFor(async () => {
                return await isAnyRunning() === false;
            });
        }
    }

    export
    namespace menu {
        export
        async function closeAll() {
            const page = context.page;
            const existingMenus = await page.$$('.lm-Menu');
            const numOpenMenus = existingMenus.length;
            // close menus
            for (let i = 0; i < numOpenMenus; ++i) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(100);
                await page.waitForFunction((menuCount: number) => {
                    return document.querySelectorAll('.lm-Menu').length === menuCount;
                }, numOpenMenus - (i + 1));
            }
        }

        export
        async function getMenuBarItem(label: string): Promise<ElementHandle<Element> | null> {
            return await context.page.$(`xpath=//li[./div[text()="${label}" and ${xpContainsClass('lm-MenuBar-itemLabel')}]]`);
        }

        export
        async function getMenuItem(path: string): Promise<ElementHandle<Element> | null> {
            const page = context.page;
            const parts = path.split('>');
            const numParts = parts.length;
            let subMenu: ElementHandle<Element> = null;

            for (let i = 0; i < numParts; ++i) {
                const part = parts[i];
                const menuItem = i === 0 ? await getMenuBarItem(part) : await getMenuItemInMenu(subMenu, part);
                if (menuItem) {
                    if (i === numParts - 1) {
                        return menuItem;
                    } else {
                        if (i === 0) {
                            subMenu = await page.$('.lm-Menu.lm-MenuBar-menu');
                        } else {
                            const newMenus = await page.$$('.lm-Menu');
                            subMenu = newMenus.length > 0 ? newMenus[newMenus.length - 1] : null;
                        }
                        if (!subMenu) {
                            return null;
                        }
                    }
                } else {
                    return null;
                }
            }

            return null;
        }

        export
        async function getMenuItemInMenu(parentMenu: ElementHandle<Element>, label: string): Promise<ElementHandle<Element> | null> {
            const items = await parentMenu.$$(`xpath=./ul/li[./div[text()="${label}" and ${xpContainsClass('lm-Menu-itemLabel')}]]`);
            if (items.length > 1) {
                throw new Error(`More than one menu item matches label '${label}'`);
            }
            return items.length > 0 ? items[0] : null;
        }

        export
        async function isAnyOpen(): Promise<boolean> {
            return await context.page.$('.lm-Menu') !== null;
        }

        export
        async function isOpen(path: string): Promise<boolean> {
            return await getMenuItem(path) !== null;
        }

        export
        async function open(path: string): Promise<ElementHandle<Element> | null> {
            await closeAll();

            const page = context.page;
            const parts = path.split('>');
            const numParts = parts.length;
            let subMenu: ElementHandle<Element> = null;

            for (let i = 0; i < numParts; ++i) {
                const part = parts[i];
                const menuItem = i === 0 ? await getMenuBarItem(part) : await getMenuItemInMenu(subMenu, part);
                if (menuItem) {
                    if (i === 0) {
                        await menuItem.click();
                        subMenu = await page.waitForSelector('.lm-Menu.lm-MenuBar-menu', { state: 'visible' });
                    } else {
                        const existingMenus = await page.$$('.lm-Menu');
                        await menuItem.hover();
                        await page.waitForFunction(({menuCount, menuItem}) => {
                            return document.querySelectorAll('.lm-Menu').length === menuCount && menuItem.classList.contains('lm-mod-active');
                        }, {menuCount: existingMenus.length + 1, menuItem: menuItem});
                        await page.waitForTimeout(200);

                        // Fetch a new list of menus, and fetch the last one.
                        // We are assuming the last menu is the most recently opened.
                        const newMenus = await page.$$('.lm-Menu');
                        subMenu = newMenus[newMenus.length - 1];
                    }
                }
            }

            return subMenu;
        }

        export
        async function getOpenMenu(): Promise<ElementHandle<Element> | null> {
            const openMenus = await context.page.$$('.lm-Widget.lm-Menu .lm-Menu-content');
            if (openMenus.length > 0) {
                return openMenus[openMenus.length - 1];
            }

            return null;
        }

        export
        async function clickMenuItem(path: string) {
            const parts = path.split('>');
            const numParts = parts.length;
            const label = parts[numParts - 1];
            path = parts.slice(0, numParts - 1).join('>');

            // open parent menu
            const parentMenu = await open(path);
            const menuItem = await getMenuItemInMenu(parentMenu, label);

            if (menuItem) {
                await menuItem.click();
            }
        }
    }

    export
    namespace activity {
        export
        async function closeAll() {
            const launcherSelector = xpBuildActivityTabSelector('Launcher');

            await context.page.evaluate(async (launcherSelector) => {
                const app = window.jupyterlab;

                await app.commands.execute('application:close-all');
                await window.galataip.waitForXPath(launcherSelector);
            }, launcherSelector);
        }

        export
        async function isTabActive(name: string): Promise<boolean> {
            const tab = await getTab(name);
            return tab && await tab.evaluate((tab) => tab.classList.contains('lm-mod-current'));
        }

        export
        async function getTab(name?: string): Promise<ElementHandle<Element> | null> {
            const page = context.page;
            const tabSelector = name ? xpBuildActivityTabSelector(name) : xpBuildActiveActivityTabSelector();
            return await page.$(`xpath=${tabSelector}`);
        }

        export
        async function getPanel(name?: string): Promise<ElementHandle<Element> | null> {
            const page = context.page;
            const tab = await getTab(name);
            if (tab) {
                const id = await tab.evaluate((tab) => tab.getAttribute('data-id'));
                return await page.$(`xpath=${xpBuildActivityPanelSelector(id)}`);
            }

            return null;
        }

        export
        async function activateTab(name: string): Promise<boolean> {
            const tab = await getTab(name);
            if (tab) {
                await tab.click();
                await context.page.waitForFunction(({tab}) => {
                    return tab.classList.contains('jp-mod-current');
                }, {tab});

                return true;
            }

            return false;
        }
    }

    export
    namespace logconsole {
        export
        async function logCount(): Promise<number> {
            return await context.page.evaluate(() => {
                let count = 0;
                const logPanels = document.querySelectorAll('.jp-LogConsolePanel .lm-StackedPanel-child');
                logPanels.forEach((logPanel) => {
                    if (!logPanel.classList.contains('lm-mod-hidden')) {
                        count += logPanel.querySelectorAll('.jp-OutputArea-child').length;
                    }
                });

                return count;
            });
        }
    }

    export
    namespace contents {
        export
        async function getContentMetadata(dirPath: string): Promise<any> {
            const apiUrl = `${context.jlabBaseUrl}/api/contents`;

            const data = JSON.stringify({
                'type':'file'
            });

            const request: AxiosRequestConfig = {
                url: `${apiUrl}/${dirPath}`,
                method: 'GET',
                data: data
            };

            if (context.jlabToken) {
                request.headers = {'Authorization': `Token ${context.jlabToken}`};
            }

            let response: any;

            try {
                response = await axios(request);
            } catch (error) {
            }

            const succeeded = response && response.status === 200;

            if (succeeded) {
                return response.data;
            }

            return null;
        }

        export
        async function directoryExists(dirPath: string): Promise<boolean> {
            const content = await getContentMetadata(dirPath);

            return content && content.type === 'directory';
        }

        export
        async function fileExists(filePath: string): Promise<boolean> {
            const content = await getContentMetadata(filePath);

            return content && (content.type === 'notebook' || content.type === 'file');
        }

        export
        async function createDirectory(dirPath: string): Promise<boolean> {
            const directories = dirPath.split('/');
            let path = '';

            for (let directory of directories) {
                if (directory.trim() === '') {
                    continue;
                }
                if (path !== '') {
                    path += '/';
                }
                path += directory;
                await _createDirectory(path);
            }

            return true;
        }

        export
        async function moveDirectoryToServer(sourcePath: string, destinationPath?: string): Promise<boolean> {
            const pos = sourcePath.lastIndexOf('/');
            const sourceDirName = sourcePath.substring(pos + 1);
            destinationPath = destinationPath === undefined ? sourceDirName : destinationPath;

            const files = getFilesInDirectory(sourcePath);
            for (let file of files) {
                const relativePath = file.substring(sourcePath.length + 1);
                await moveFileToServer(file, `${destinationPath}/${relativePath}`);
            }

            return true;
        }

        export
        async function moveFileToServer(sourcePath: string, destinationPath?: string): Promise<boolean> {
            const apiUrl = `${context.jlabBaseUrl}/api/contents`;
            const fileName = destinationPath ? destinationPath : path.basename(sourcePath);
            const pos = destinationPath ? destinationPath.lastIndexOf('/') : -1;
            if (pos !== -1) {
                const destDir = destinationPath.substring(0, pos);
                if (!await directoryExists(destDir)) {
                    await createDirectory(destDir);
                }
            }

            const data = JSON.stringify({
                'content': _base64EncodeFile(sourcePath),
                'format': 'base64',
                'type':'file'
            });

            const request: AxiosRequestConfig = {
                url: `${apiUrl}/${fileName}`,
                method: 'PUT',
                data: data,
                maxContentLength: Infinity
            };

            if (context.jlabToken) {
                request.headers = {'Authorization': `Token ${context.jlabToken}`};
            }

            let response: any;

            try {
                response = await axios(request);
            } catch (error) {
                console.error(error);
            }

            const succeeded = response && response.status === 201;

            if (succeeded) {
                return await fileExists(`${apiUrl}/${fileName}`);
            }

            return false;
        }

        export
        async function deleteFile(filePath: string): Promise<boolean> {
            await context.page.evaluate(async ({pluginId, filePath}) => {
                const docManager = await window.galataip.getPlugin(pluginId) as IDocumentManager;
                await docManager.deleteFile(filePath);
            }, {pluginId: PLUGIN_ID_DOC_MANAGER as keyof IPluginNameToInterfaceMap, filePath: filePath});

            return true;
        }

        export
        async function deleteDirectory(dirPath: string): Promise<boolean> {
            const dirContent = await getContentMetadata(dirPath);

            if (!(dirContent && dirContent.type === 'directory')) {
                return false;
            }

            let anyFailed = false;

            // delete directory contents first
            for (let item of dirContent.content) {
                if (item.type === 'directory') {
                    if (!await deleteDirectory(item.path)) {
                        anyFailed = true;
                    }
                } else {
                    if (!await deleteFile(item.path)) {
                        anyFailed = true;
                    }
                }
            }

            if (!await deleteFile(dirPath)) {
                anyFailed = true;
            }

            return !anyFailed;
        }

        export
        async function renameFile(oldName: string, newName: string): Promise<boolean> {
            return await context.page.evaluate(async ({pluginId, oldName, newName}) => {
                const docManager = await window.galataip.getPlugin(pluginId) as IDocumentManager;
                const result = await docManager.rename(oldName, newName);
                return result != null;
            }, {pluginId: PLUGIN_ID_DOC_MANAGER as keyof IPluginNameToInterfaceMap, oldName: oldName, newName: newName});
        }

        export
        async function renameDirectory(oldName: string, newName: string): Promise<boolean> {
            return await renameFile(oldName, newName);
        }

        export
        async function waitForAPIResponse(trigger?: () => Promise<void> | void) {
            const page = context.page;
            return new Promise<void>(async (resolve, reject) => {
                page.on('response', function callback(response) {
                    if (response.url().includes("api/contents")) {
                        page.removeListener('response', callback);
                        resolve();
                    }
                });

                if (trigger) {
                    await trigger();
                }
            });
        }

        async function _createDirectory(dirPath: string): Promise<boolean> {
            const apiUrl = `${context.jlabBaseUrl}/api/contents`;

            const data = JSON.stringify({
                'format': 'json',
                'type': 'directory'
            });

            const request: AxiosRequestConfig = {
                url: `${apiUrl}/${dirPath}`,
                method: 'PUT',
                data: data
            };

            if (context.jlabToken) {
                request.headers = {'Authorization': `Token ${context.jlabToken}`};
            }

            let response: any;

            try {
                response = await axios(request);
            } catch (error) {
            }

            return response && response.status === 201;
        }
    }

    export
    namespace filebrowser {
        export
        function xpBuildFileSelector(fileName: string) {
            return `//div[@id='filebrowser']//li[./span[${xpContainsClass('jp-DirListing-itemText')} and ./span[text()="${fileName}"]]]`;
        }
        export
        function xpBuildDirectorySelector(dirName: string) {
            return `//div[@id='filebrowser']//li[@data-isdir='true' and ./span[${xpContainsClass('jp-DirListing-itemText')} and ./span[text()="${dirName}"]]]`;
        }

        export
        async function revealFileInBrowser(filePath: string): Promise<void> {
            const pos = filePath.lastIndexOf('/');
            const dirPath = filePath.substring(0, pos);
            const fileName = filePath.substring(pos + 1);

            await openDirectory(dirPath);

            await waitFor(async () => {
                return await isFileListedInBrowser(fileName);
            });
        }

        export
        async function isFileListedInBrowser(fileName: string): Promise<boolean> {
            const item = await context.page.$(`xpath=${xpBuildFileSelector(fileName)}`);
            return item !== null;
        }

        export
        async function getCurrentDirectory(): Promise<string> {
            return await context.page.evaluate(() => {
                let directory = '';
                const spans = document.querySelectorAll('.jp-FileBrowser .jp-FileBrowser-crumbs span');
                const numSpans = spans.length;
                if (numSpans > 1) {
                    directory = spans[numSpans - 2].getAttribute('title');
                }

                return directory;
            });
        }

        export
        async function openHomeDirectory(): Promise<boolean> {
            const homeButton = await context.page.$('.jp-FileBrowser .jp-FileBrowser-crumbs span');
            if (!homeButton) {
                return false;
            }
            await homeButton.click();

            await context.page.waitForFunction(() => {
                const spans = document.querySelectorAll('.jp-FileBrowser .jp-FileBrowser-crumbs span');
                return spans.length === 2 && spans[0].classList.contains('jp-BreadCrumbs-home');
            });

            // wait for DOM rerender
            await waitFor(200);

            return true;
        }

        export
        async function openDirectory(dirPath: string): Promise<boolean> {
            if (!await openHomeDirectory()) {
                return false;
            }

            const directories = dirPath.split('/');
            let path = '';

            for (let directory of directories) {
                if (directory.trim() === '') {
                    continue;
                }
                if (path !== '') {
                    path += '/';
                }

                path += directory;

                if (!await _openDirectory(directory)) {
                    return false;
                }

                await waitFor(async () => {
                    return await getCurrentDirectory() === path;
                });
            }

            return true;
        }

        export
        async function refresh(): Promise<void> {
            const page = context.page;
            const item = await page.$(`xpath=//div[@id='filebrowser']//button[${xpContainsClass('jp-ToolbarButtonComponent')} and .//*[@data-icon='ui-components:refresh']]`);

            if (item) {
                // wait for network response or timeout
                await Promise.race([
                    waitForDuration(2000),
                    contents.waitForAPIResponse(async () => {
                        await item.click();
                    })
                ]);
                // wait for DOM rerender
                await waitFor(200);
            } else {
                throw new Error('Could not find refresh toolbar item');
            }
        }

        async function _openDirectory(dirName: string): Promise<boolean> {
            const item = await context.page.$(`xpath=${xpBuildDirectorySelector(dirName)}`);
            if (item === null) {
                return false;
            }

            await contents.waitForAPIResponse(async () => {
                await item.click({ clickCount: 2});
            });
            // wait for DOM rerender
            await waitFor(200);

            return true;
        }
    }

    export
    namespace notebook {
        export
        async function isOpen(name: string): Promise<boolean> {
            const tab = await activity.getTab(name);
            return tab !== null;
        }

        export
        async function isActive(name: string): Promise<boolean> {
            return activity.isTabActive(name);
        }

        export
        async function isAnyActive(): Promise<boolean> {
            return await getNotebookInPanel() !== null;
        }

        export
        async function open(name: string): Promise<boolean> {
            const fileItem = await context.page.$(`xpath=${filebrowser.xpBuildFileSelector(name)}`);
            if (fileItem) {
                fileItem.click({ clickCount: 2 });
                await context.page.waitForSelector(xpBuildActivityTabSelector(name), { state: 'visible' });
            }

            return await isOpen(name);
        }

        export
        async function openByPath(filePath: string): Promise<boolean> {
            await filebrowser.revealFileInBrowser(filePath);
            const notebookName = path.basename(filePath);
            return await open(notebookName);
        }

        export
        async function getNotebookInPanel(name?: string): Promise<ElementHandle<Element> | null> {
            const nbPanel = await activity.getPanel(name);

            if (nbPanel) {
                return await nbPanel.$('.jp-NotebookPanel-notebook');
            }

            return null;
        }

        export
        async function activate(name: string): Promise<boolean> {
            if (await activity.activateTab(name)) {
                await context.page.evaluate(async () => {
                    const galataip = window.galataip;
                    const nbPanel = galataip.app.shell.currentWidget as NotebookPanel;
                    await nbPanel.sessionContext.ready;
                    // Assuming that if the session is ready, the kernel is ready also for now and commenting out this line
                    // await nbPanel.session.kernel.ready;

                    galataip.app.shell.activateById(nbPanel.id);
                });

                return true;
            }

            return false;
        }

        export
        async function save(): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            await context.page.evaluate(async () => {
                await window.galataip.saveActiveNotebook();
            });

            return true;
        }

        export
        async function revertChanges(): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            await context.page.evaluate(async () => {
                const app = window.galataip.app;
                const nbPanel = app.shell.currentWidget as NotebookPanel;
                await nbPanel.context.revert();
            });

            return true;
        }

        export
        async function run(): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            await menu.clickMenuItem('Run>Run All Cells');
            await waitForRun();

            return true;
        }

        export
        async function runCellByCell(callback?: INotebookRunCallback): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            let callbackName = '';

            if (callback) {
                callbackName = `_runCallbacksExposed${++_runCallbacksExposed}`;

                await context.page.exposeFunction(`${callbackName}_onBeforeScroll`, async () => {
                    if (callback && callback.onBeforeScroll) {
                        await callback.onBeforeScroll();
                    }
                });

                await context.page.exposeFunction(`${callbackName}_onAfterScroll`, async () => {
                    if (callback && callback.onAfterScroll) {
                        await callback.onAfterScroll();
                    }
                });

                await context.page.exposeFunction(`${callbackName}_onAfterCellRun`, async (cellIndex: number) => {
                    if (callback && callback.onAfterCellRun) {
                        await callback.onAfterCellRun(cellIndex);
                    }
                });
            }

            await context.page.evaluate(async (callbackName: string) => {
                const callbacks = callbackName === '' ? undefined : {
                    onBeforeScroll: async () => {
                        await window[`${callbackName}_onBeforeScroll`]();
                    },
                    
                    onAfterScroll: async () => {
                        await window[`${callbackName}_onAfterScroll`]();
                    },

                    onAfterCellRun: async (cellIndex: number) => {
                        await window[`${callbackName}_onAfterCellRun`](cellIndex);
                    }
                } as INotebookRunCallback;

                await window.galataip.runActiveNotebookCellByCell(callbacks);
            }, callbackName);

            return true;
        }

        export
        async function waitForRun() {
            await context.page.evaluate(async () => {
                await window.galataip.waitForNotebookRun();
            });
        }

        export
        async function close(revertChanges: boolean = true): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            const page = context.page;
            const tab = await activity.getTab();

            if (!tab) {
                return false;
            }

            if (revertChanges) {
                if (!await notebook.revertChanges()) {
                    return false;
                }
            }

            const closeIcon = await tab.$('.lm-TabBar-tabCloseIcon');
            if (!closeIcon) {
                return false;
            }

            await closeIcon.click();

            if (!revertChanges) {
                // close save prompt
                const dialogSelector = '.jp-Dialog .jp-Dialog-content';
                const dialog = await page.$(dialogSelector);
                const okButton = dialog ?? await dialog.$('button.jp-mod-accept');
                if (okButton) {
                    await okButton.click();
                }
                await page.waitForSelector(dialogSelector, { state: 'hidden' });
            }

            return true;
        }

        export
        async function getCellCount(): Promise<number> {
            const notebook = await getNotebookInPanel();
            if (!notebook) {
                return -1;
            }

            const cells = await notebook.$$('div.jp-Cell');

            return cells.length;
        }

        export
        async function getCellOutput(cellIndex: number): Promise<ElementHandle<Element> | null> {
            const notebook = await getNotebookInPanel();
            if (!notebook) {
                return null;
            }

            const cells = await notebook.$$('div.jp-Cell');

            if (cellIndex < 0 || cellIndex >= cells.length) {
                return null;
            }

            const cell = cells[cellIndex];

            const codeCellOutput = await cell.$('.jp-Cell-outputArea');
            if (codeCellOutput) {
                return codeCellOutput;
            }

            const mdCellOutput = await cell.$('.jp-MarkdownOutput');
            if (mdCellOutput) {
                return mdCellOutput;
            }

            return null;
        }

        export
        async function getCellTextOutput(cellIndex: number): Promise<string[] | null> {
            const cellOutput = await getCellOutput(cellIndex);
            if (!cellOutput) {
                return null;
            }

            const textOutputs = await cellOutput.$$('.jp-OutputArea-output');
            if (textOutputs.length > 0) {
                let outputs: string[] = [];
                for (let textOutput of textOutputs) {
                    outputs.push(await (await textOutput.getProperty('textContent')).jsonValue() as string);
                }

                return outputs;
            }

            return null;
        }

        export
        async function deleteCells(): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            await context.page.evaluate(() => {
                return window.galataip.deleteNotebookCells();
            });

            return true;
        }

        export
        async function addCell(cellType: nbformat.CellType, source: string): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            return await context.page.evaluate(({cellType, source}) => {
                return window.galataip.addNotebookCell(cellType, source);
            }, {cellType, source});
        }

        export
        async function setCell(cellIndex: number, cellType: nbformat.CellType, source: string): Promise<boolean> {
            if (!await isAnyActive()) {
                return false;
            }

            return await context.page.evaluate(({cellIndex, cellType, source}) => {
                return window.galataip.setNotebookCell(cellIndex, cellType, source);
            }, {cellIndex, cellType, source});
        }

        export
        async function getCellType(cellIndex: number): Promise<nbformat.CellType | null> {
            const notebook = await getNotebookInPanel();
            if (!notebook) {
                return null;
            }
            const cells = await notebook.$$('div.jp-Cell');

            if (cellIndex < 0 || cellIndex >= cells.length) {
                return null;
            }

            const cell = cells[cellIndex];

            const classList = await _getElementClassList(cell);

            if (classList.indexOf('jp-CodeCell') != -1) {
                return 'code';
            } else if (classList.indexOf('jp-MarkdownCell') != -1) {
                return 'markdown';
            } else if (classList.indexOf('jp-RawCell') != -1) {
                return 'raw';
            }

            return null;
        }

        export
        async function createNew(name?: string): Promise<boolean> {
            await menu.clickMenuItem('File>New>Notebook');

            const page = context.page;
            await page.waitForSelector('.jp-Dialog');
            await page.click('.jp-Dialog .jp-mod-accept');

            const activeTab = await activity.getTab();
            if (!activeTab) {
                return false;
            }

            if (!name) {
                return true;
            }

            const label = await activeTab.$('div.lm-TabBar-tabLabel');
            if (!label) {
                return false;
            }

            const assignedName = await (await label.getProperty('textContent')).jsonValue() as string;
            await contents.renameFile(assignedName, name);
            const renamedTab = await activity.getTab(name);

            return renamedTab !== null;
        }
    }

    export
    namespace statusbar {
        export
        async function isVisible(): Promise<boolean> {
            return await context.page.evaluate(() => {
                const statusBar = document.querySelector('#jp-main-statusbar') as HTMLElement;
                return window.galataip.isElementVisible(statusBar);
            });
        }

        export
        async function show() {
            const visible = await isVisible();
            if (visible) {
                return;
            }

            await menu.clickMenuItem('View>Show Status Bar');
            await context.page.waitForSelector('#jp-main-statusbar', { state: 'visible' });
        }

        export
        async function hide() {
            const visible = await isVisible();
            if (!visible) {
                return;
            }

            await menu.clickMenuItem('View>Show Status Bar');
            await context.page.waitForSelector('#jp-main-statusbar', { state: 'hidden' });
        }
    }

    export
    namespace sidebar {
        export
        async function isOpen(side: SidebarPosition = 'left'): Promise<boolean> {
            return await getContentPanel(side) !== null;
        }

        export
        async function isTabOpen(id: SidebarTabId): Promise<boolean> {
            const tabButton = await context.page.$(`${buildTabSelector(id)}.lm-mod-current`);
            return tabButton !== null;
        }

        export
        async function getTabPosition(id: SidebarTabId): Promise<SidebarPosition | null> {
            return await context.page.evaluate(async ({tabSelector}) => {
                const tabButton = document.querySelector(tabSelector);
                if (!tabButton) {
                    return null;
                }

                const sideBar = tabButton.closest('.jp-SideBar');
                if (!sideBar) {
                    return null;
                }

                return sideBar.classList.contains('jp-mod-right') ? 'right' : 'left';
            }, {tabSelector: buildTabSelector(id)});
        }

        export
        async function moveTabToLeft(id: SidebarTabId): Promise<void> {
            await setTabPosition(id, 'left');
        }

        export
        async function moveTabToRight(id: SidebarTabId): Promise<void> {
            await setTabPosition(id, 'right');
        }

        export
        async function setTabPosition(id: SidebarTabId, side: SidebarPosition): Promise<void> {
            const position = await getTabPosition(id);

            if (position === side) {
                return;
            }

            await toggleTabPosition(id);

            await waitFor(async () => {
                return await getTabPosition(id) === side;
            });
        }

        export
        async function toggleTabPosition(id: SidebarTabId): Promise<void> {
            const tab = await getTab(id);

            if (!tab) {
                return;
            }

            await tab.click({button: 'right'});

            const switchMenuItem = await context.page.waitForSelector('.lm-Menu-content .lm-Menu-item[data-command="sidebar:switch"]', { state: 'visible' });
            if (switchMenuItem) {
                await switchMenuItem.click();
            }
        }

        export
        async function moveAllTabsToLeft(): Promise<void> {
            await context.page.evaluate(async ({pluginId}) => {
                const settingRegistry = await window.galataip.getPlugin(pluginId) as ISettingRegistry;
                const SIDEBAR_ID = '@jupyterlab/application-extension:sidebar';
                const overrides =  (await settingRegistry.get(SIDEBAR_ID, 'overrides')).composite;
                for (let widgetId of Object.keys(overrides)) {
                    overrides[widgetId] = 'left';
                }
                // default location of property inspector is right, move it to left during tests
                overrides["jp-property-inspector"] = "left";
                await settingRegistry.set(SIDEBAR_ID, 'overrides', overrides);
            }, {pluginId: PLUGIN_ID_SETTINGS as keyof IPluginNameToInterfaceMap});

            await context.page.waitForFunction(() => {
                const rightStack = document.getElementById('jp-right-stack');
                return rightStack.childElementCount === 0;
            });
        }

        export
        async function getTab(id: SidebarTabId): Promise<ElementHandle<Element>> {
            return await context.page.$(buildTabSelector(id));
        }

        export
        async function openTab(id: SidebarTabId) {
            const isOpen = await isTabOpen(id);
            if (isOpen) {
                return;
            }

            const tabButton = await context.page.$(buildTabSelector(id));
            await tabButton.click();
            await _waitForTabActivate(tabButton);
        }

        export
        async function getContentPanel(side: SidebarPosition = 'left'): Promise<ElementHandle<Element>> {
            return await context.page.$(`#jp-${side}-stack .p-StackedPanel-child:not(.lm-mod-hidden)`);
        }

        export
        async function open(side: SidebarPosition = 'left') {
            const isOpen = await sidebar.isOpen(side);
            if (isOpen) {
                return;
            }

            await menu.clickMenuItem(`View>Show ${side === 'left' ? 'Left' : 'Right'} Sidebar`);

            await waitFor(async () => {
                return await sidebar.isOpen(side);
            });
        }

        export
        async function close(side: SidebarPosition = 'left') {
            const isOpen = await sidebar.isOpen(side);
            if (!isOpen) {
                return;
            }

            await menu.clickMenuItem(`View>Show ${side === 'left' ? 'Left' : 'Right'} Sidebar`);

            await waitFor(async () => {
                return !await sidebar.isOpen(side);
            });
        }
        
        export
        function buildTabSelector(id: SidebarTabId): string {
            return `.lm-TabBar.jp-SideBar .lm-TabBar-content li.lm-TabBar-tab[data-id="${id}"]`;
        }

        async function _waitForTabActivate(tab: ElementHandle<Element>, activate: boolean = true) {
            await context.page.waitForFunction(({tab, activate}) => {
                const current = tab.classList.contains('lm-mod-current');
                return activate ? current : !current;
            }, {tab, activate});
        }
    }

    export
    namespace theme {
        export
        async function setDarkTheme() {
            await setTheme('JupyterLab Dark');
        }

        export
        async function setLightTheme() {
            await setTheme('JupyterLab Light');
        }

        export
        async function getTheme(): Promise<string> {
            return await context.page.evaluate(() => {
                return document.body.dataset.jpThemeName;
            });
        }

        export
        async function setTheme(themeName: string) {
            await context.page.evaluate(async (themeName: string) => {
                await window.galataip.setTheme(themeName);
            }, themeName);
        }
    }

    export
    async function resetUI() {
        // close menus
        await menu.closeAll();
        // close all panels
        await activity.closeAll();
        // shutdown kernels
        await kernel.shutdownAll();
        // show status bar
        await statusbar.show();
        // make sure all sidebar tabs are on left
        await sidebar.moveAllTabsToLeft();
        // show Files tab on sidebar
        await sidebar.openTab('filebrowser');
        // go to home folder
        await filebrowser.openHomeDirectory();
    }

    export
    async function isInSimpleMode(): Promise<boolean> {
        const toggle = await context.page.$('#jp-single-document-mode button.jp-switch');
        const checked = await toggle.getAttribute('aria-checked') === 'true';

        return checked;
    }

    export
    async function toggleSimpleMode(simple: boolean): Promise<boolean> {
        const toggle = await context.page.$('#jp-single-document-mode button.jp-switch');
        const checked = await toggle.getAttribute('aria-checked') === 'true';

        if ((checked && !simple) || (!checked && simple)) {
            toggle.click();
        }

        await waitFor(async () => {
            return await isInSimpleMode() === simple;
        });

        return true;
    }
};

export { describeWrapper as describe, testWrapper as test };
