// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { jlt, describe, test } from '../src/index';
import * as path from 'path';

jest.setTimeout(100000);

describe('Notebook Run', () => {
    beforeAll(async () => {
        await jlt.resetUI();
        jlt.context.capturePrefix = 'notebook-run';
    });

    afterAll(async () => {
        jlt.context.capturePrefix = '';
    });

    test('Upload files', async () => {
        await jlt.contents.moveDirectoryToServer(path.resolve(__dirname, `./notebooks`), 'uploaded');
        expect(await jlt.contents.fileExists('uploaded/example.ipynb')).toBeTruthy();
        expect(await jlt.contents.fileExists('uploaded/jupyter.png')).toBeTruthy();
    });

    test('Refresh File Browser', async () => {
        await jlt.filebrowser.refresh();
    });

    test('Open directory uploaded', async () => {
        await jlt.filebrowser.openDirectory('uploaded');
        expect(await jlt.filebrowser.isFileListedInBrowser('example.ipynb')).toBeTruthy();
    });

    test('Run notebook example.ipynb', async () => {
        const notebook = 'example.ipynb';
        await jlt.notebook.open(notebook);
        expect(await jlt.notebook.isOpen(notebook)).toBeTruthy();
        await jlt.notebook.activate(notebook);
        expect(await jlt.notebook.isActive(notebook)).toBeTruthy();

        await jlt.notebook.runCellByCell();
        await jlt.capture.screenshot('example-run');
    });

    test('Check 2+2 cell output', async () => {
        const cellOutput2 = await jlt.notebook.getCellTextOutput(2);
        expect(parseInt(cellOutput2[0])).toBe(4);
    });

    test('Check calculation output', async () => {
        const cellOutput4 = await jlt.notebook.getCellTextOutput(4);
        expect(parseFloat(cellOutput4[0])).toBeGreaterThan(1.5);
    });

    test('Close notebook example.ipynb', async () => {
        await jlt.notebook.close(true);
    });

    test('Open home directory', async () => {
        await jlt.filebrowser.openHomeDirectory();
    });

    test('Delete uploaded files', async () => {
        await jlt.contents.deleteDirectory('uploaded');
    });
});
