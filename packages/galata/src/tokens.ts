// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { Page, Browser } from 'playwright';

export
type CaptureType = 'image' | 'html';

export
type CaptureCompareResult = 'uncompared' | 'missing-capture' | 'missing-reference' | 'different-size' | 'different' | 'same';

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
    onPageCreated?: (page: Page) => Promise<void> | void;
    onPageLoaded?: (page: Page) => Promise<void> | void;
};

export
type CreateNewPageFunction = (options?: ICreateNewPageOptions) => Promise<Page>;

export
interface IGalataContext {
    testId: string;
    browserType: string;
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
    browser: Browser;
    page: Page;
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
