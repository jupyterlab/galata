// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { galata, describe, test } from '../src/index';
import * as path from 'path';

jest.setTimeout(100000);

describe('Notebook Run', () => {
    beforeAll(async () => {
        await galata.resetUI();
        galata.context.capturePrefix = 'notebook-run';
    });

    afterAll(async () => {
        galata.context.capturePrefix = '';
    });

    test('Upload files', async () => {
        await galata.contents.moveDirectoryToServer(path.resolve(__dirname, `./notebooks`), 'uploaded');
        expect(await galata.contents.fileExists('uploaded/example.ipynb')).toBeTruthy();
        expect(await galata.contents.fileExists('uploaded/jupyter.png')).toBeTruthy();
    });

    test('Refresh File Browser', async () => {
        await galata.filebrowser.refresh();
    });

    test('Open directory uploaded', async () => {
        await galata.filebrowser.openDirectory('uploaded');
        expect(await galata.filebrowser.isFileListedInBrowser('example.ipynb')).toBeTruthy();
    });

    test('Run notebook example.ipynb', async () => {
        const notebook = 'example.ipynb';
        await galata.notebook.open(notebook);
        expect(await galata.notebook.isOpen(notebook)).toBeTruthy();
        await galata.notebook.activate(notebook);
        expect(await galata.notebook.isActive(notebook)).toBeTruthy();

        await galata.notebook.runCellByCell();
        await galata.capture.screenshot('example-run');
    });

    test('Check 2+2 cell output', async () => {
        const cellOutput2 = await galata.notebook.getCellTextOutput(2);
        expect(parseInt(cellOutput2[0])).toBe(4);
    });

    test('Check calculation output', async () => {
        const cellOutput4 = await galata.notebook.getCellTextOutput(4);
        expect(parseFloat(cellOutput4[0])).toBeGreaterThan(1.5);
    });

    test('Close notebook example.ipynb', async () => {
        await galata.notebook.close(true);
    });

    test('Open home directory', async () => {
        await galata.filebrowser.openHomeDirectory();
    });

    test('Delete uploaded files', async () => {
        await galata.contents.deleteDirectory('uploaded');
    });
});
