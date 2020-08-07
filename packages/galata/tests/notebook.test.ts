// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { jlt, describe, test } from '../src/index';

describe('Notebook Tests', () => {
    beforeAll(async () => {
        await jlt.resetUI();
        jlt.context.capturePrefix = 'notebook';
    });

    afterAll(() => {
        jlt.context.capturePrefix = '';
    });

    const fileName = "create_test.ipynb";

    test("Create New Notebook", async () => {
        await jlt.notebook.createNew(fileName);
    });

    test("Create Markdown cell", async () => {
        await jlt.notebook.setCell(0, 'markdown', '## This is a markdown cell');
        expect(await jlt.notebook.getCellCount()).toBe(1);
        expect(await jlt.notebook.getCellType(0)).toBe('markdown');
    });

    test("Create Raw cell", async () => {
        await jlt.notebook.addCell('raw', 'This is a raw cell');
        expect(await jlt.notebook.getCellCount()).toBe(2);
        expect(await jlt.notebook.getCellType(1)).toBe('raw');
    });

    test("Create Code cell", async () => {
        await jlt.notebook.addCell('code', '2 + 2');
        expect(await jlt.notebook.getCellCount()).toBe(3);
        expect(await jlt.notebook.getCellType(2)).toBe('code');
    });

    test("Capture notebook", async () => {
        const imageName = 'capture-notebook';
        await jlt.capture.screenshot(imageName);
    });

    test("Run Cells", async () => {
        await jlt.notebook.run();
        await jlt.notebook.save();
        const imageName = 'run-cells';

        expect((await jlt.notebook.getCellTextOutput(2))[0]).toBe('4');

        await jlt.capture.screenshot(imageName);
    });

    test("Delete Notebook", async () => {
        await jlt.contents.deleteFile(fileName);

        const imageName = 'delete-notebook';
        await jlt.capture.screenshot(imageName);
    });
});
