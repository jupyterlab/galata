// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import {
    JupyterFrontEnd
} from "@jupyterlab/application";

import {
    IJLabTestContext
} from "./tokens";

import {
    IJlabTestInpage
} from "./inpage/tokens";

declare global {
    interface Window {
        lab: JupyterFrontEnd;
        jltip: IJlabTestInpage;
        screenshot: (fileName: string) => Promise<void>;
    }

    namespace NodeJS {
        interface Global {
            __TEST_CONTEXT__: IJLabTestContext;
        }
    }
}
