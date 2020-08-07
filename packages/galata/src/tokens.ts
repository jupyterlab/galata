// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import * as puppeteer from 'puppeteer-core';

export
type CaptureType = 'image' | 'image-diff' | 'html' | 'html-diff';

export
type CaptureCompareResult = 'missing-capture' | 'missing-reference' | 'different' | 'same';

export
interface ICapture {
    type: CaptureType;
    name: string;
    fileName: string;
    result?: CaptureCompareResult;
}

export
interface ITestLog {
    type: 'info' | 'warning' | 'error';
    message: string;
}

export
type TestCaptures = { [key: string]: { [key: string]: ICapture[] } };

export
type TestLogs = { [key: string]: { [key: string]: ITestLog[] } };

export
interface ICreateNewPageOptions {
    generateWorkspace?: boolean;
    onPageCreated?: (page: puppeteer.Page) => Promise<void> | void;
    onPageLoaded?: (page: puppeteer.Page) => Promise<void> | void;
};

export
type CreateNewPageFunction = (options?: ICreateNewPageOptions) => Promise<puppeteer.Page>;

export
interface IJLabTestContext {
    testId: string;
    chromePath: string;
    jlabBaseUrl: string;
    jlabToken: string;
    jlabWorkspace: string;
    jlabUrl: string;
    skipVisualRegression: boolean;
    skipHtmlRegression: boolean;
    discardMatchedCaptures: boolean;
    testOutputDir: string;
    referenceDir: string;
    capturePrefix: string;
    browser: puppeteer.Browser;
    page: puppeteer.Page;
    exposedFunctions: string[];
    suite: number;
    suiteName: string;
    step: number;
    stepName: string;
    testCaptures: TestCaptures;
    testLogs: TestLogs;
    imageMatchThreshold: number;
    _createNewPage: CreateNewPageFunction;
    _reloadPage: Function;
};
