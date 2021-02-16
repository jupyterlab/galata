// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { galata, describe, test } from '@jupyterlab/galata';

describe('A Test Suite', () => {
    beforeAll(async () => {
        await galata.resetUI();
        galata.context.capturePrefix = 'suite';
    });

    afterAll(() => {
        galata.context.capturePrefix = '';
    });
    
    test('A test', () => {
        expect(2 + 2).toBe(4);
    });
});
