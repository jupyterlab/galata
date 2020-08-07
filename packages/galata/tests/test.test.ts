// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { jlt, describe, test } from '../src/index';

describe('A Test Suite', () => {
    beforeAll(async () => {
        await jlt.resetUI();
        jlt.context.capturePrefix = 'suite';
    });

    afterAll(() => {
        jlt.context.capturePrefix = '';
    });
    
    test('A test', () => {
        expect(2 + 2).toBe(4);
    });
});
