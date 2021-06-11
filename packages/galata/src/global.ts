// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { JupyterFrontEnd } from '@jupyterlab/application';

import { IGalataContext } from './tokens';

import { IGalataInpage } from './inpage/tokens';

declare global {
  interface Window {
    jupyterlab: JupyterFrontEnd;
    galataip: IGalataInpage;
    screenshot: (fileName: string) => Promise<void>;
  }

  namespace NodeJS {
    interface Global {
      __TEST_CONTEXT__: IGalataContext;
    }
  }
}
