// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { jlt, describe, test } from '../src/index';
import * as path from 'path';

jest.setTimeout(60000);

describe('Contents API Tests', () => {
    beforeAll(async () => {
        await jlt.resetUI();
        jlt.context.capturePrefix = 'contents';
    });

    afterAll(async () => {
        jlt.context.capturePrefix = '';
    });
    
    test('Upload directory to server', async () => {
        await jlt.contents.moveDirectoryToServer(path.resolve(__dirname, './upload'), 'uploaded_dir');
    });

    test('Open folder of notebooks and run', async () => {
        const sourceDir = path.resolve(__dirname, './upload');
        const files = jlt.getFilesInDirectory(sourceDir);
        for (let file of files) {
            if (file.endsWith('.ipynb')) {
                const relativePath = file.substring(sourceDir.length + 1);
                const serverPath = `uploaded_dir/${relativePath}`;
                await jlt.notebook.openByPath(serverPath);
                await jlt.notebook.runCellByCell();
                await jlt.notebook.revertChanges();
                await jlt.notebook.close();
            }
        }
    });

    test('File operations', async () => {
        await jlt.contents.moveFileToServer(path.resolve(__dirname, './upload/upload_image.png'));
        await jlt.contents.renameFile('upload_image.png', 'renamed_image.png');
        expect(await jlt.contents.fileExists('renamed_image.png')).toBeTruthy();
        await jlt.contents.deleteFile('renamed_image.png');

        // into sub folder
        await jlt.contents.moveFileToServer(path.resolve(__dirname, './upload/upload_image.png'), 'sub_dir/image.png');
        await jlt.contents.renameFile('sub_dir/image.png', 'sub_dir/renamed_image.png');
        await jlt.filebrowser.openDirectory('sub_dir');
        expect(await jlt.filebrowser.getCurrentDirectory()).toBe('sub_dir')
        expect(await jlt.contents.fileExists('sub_dir/renamed_image.png')).toBeTruthy();
    });

    test('Go to home directory', async () => {
        await jlt.filebrowser.openHomeDirectory();
    });

    test('File Explorer visibility', async () => {
        expect(await jlt.filebrowser.isFileListedInBrowser('renamed_image.png')).toBeFalsy();
        await jlt.filebrowser.revealFileInBrowser('sub_dir/renamed_image.png');
        expect(await jlt.filebrowser.isFileListedInBrowser('renamed_image.png')).toBeTruthy();
    });

    test('Delete uploads', async () => {
        await jlt.filebrowser.openHomeDirectory();
        await jlt.contents.deleteDirectory('uploaded_dir');
        await jlt.contents.deleteDirectory('sub_dir');
    });
});
