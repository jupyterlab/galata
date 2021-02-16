// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { galata, describe, test } from '../src/index';

describe('Notebook Tests', () => {
    beforeAll(async () => {
        await galata.resetUI();
        galata.context.capturePrefix = 'notebook';
    });

    afterAll(() => {
        galata.context.capturePrefix = '';
    });

    const fileName = "create_test.ipynb";

    test("Create New Notebook", async () => {
        await galata.notebook.createNew(fileName);
    });

    test("Create Markdown cell", async () => {
        await galata.notebook.setCell(0, 'markdown', '## This is a markdown cell');
        expect(await galata.notebook.getCellCount()).toBe(1);
        expect(await galata.notebook.getCellType(0)).toBe('markdown');
    });

    test("Create Raw cell", async () => {
        await galata.notebook.addCell('raw', 'This is a raw cell');
        expect(await galata.notebook.getCellCount()).toBe(2);
        expect(await galata.notebook.getCellType(1)).toBe('raw');
    });

    test("Create Code cell", async () => {
        await galata.notebook.addCell('code', '2 + 2');
        expect(await galata.notebook.getCellCount()).toBe(3);
        expect(await galata.notebook.getCellType(2)).toBe('code');
    });

    test("Capture notebook", async () => {
        const imageName = 'capture-notebook';
        await galata.capture.screenshot(imageName);
    });

    test("Run Cells", async () => {
        await galata.notebook.run();
        await galata.notebook.save();
        const imageName = 'run-cells';

        expect((await galata.notebook.getCellTextOutput(2))[0]).toBe('4');

        await galata.capture.screenshot(imageName);
    });

    test("Delete Notebook", async () => {
        await galata.contents.deleteFile(fileName);

        const imageName = 'delete-notebook';
        await galata.capture.screenshot(imageName);
    });
});
