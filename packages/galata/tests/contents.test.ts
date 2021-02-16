// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { galata, describe, test } from '../src/index';
import * as path from 'path';

jest.setTimeout(60000);

describe('Contents API Tests', () => {
    beforeAll(async () => {
        await galata.resetUI();
        galata.context.capturePrefix = 'contents';
    });

    afterAll(async () => {
        galata.context.capturePrefix = '';
    });
    
    test('Upload directory to server', async () => {
        await galata.contents.moveDirectoryToServer(path.resolve(__dirname, './upload'), 'uploaded_dir');
    });

    test('Open folder of notebooks and run', async () => {
        const sourceDir = path.resolve(__dirname, './upload');
        const files = galata.getFilesInDirectory(sourceDir);
        for (let file of files) {
            if (file.endsWith('.ipynb')) {
                const relativePath = file.substring(sourceDir.length + 1);
                const serverPath = `uploaded_dir/${relativePath}`;
                await galata.notebook.openByPath(serverPath);
                await galata.notebook.runCellByCell();
                await galata.notebook.revertChanges();
                await galata.notebook.close();
            }
        }
    });

    test('File operations', async () => {
        await galata.contents.moveFileToServer(path.resolve(__dirname, './upload/upload_image.png'));
        await galata.contents.renameFile('upload_image.png', 'renamed_image.png');
        expect(await galata.contents.fileExists('renamed_image.png')).toBeTruthy();
        await galata.contents.deleteFile('renamed_image.png');

        // into sub folder
        await galata.contents.moveFileToServer(path.resolve(__dirname, './upload/upload_image.png'), 'sub_dir/image.png');
        await galata.contents.renameFile('sub_dir/image.png', 'sub_dir/renamed_image.png');
        await galata.filebrowser.openDirectory('sub_dir');
        expect(await galata.filebrowser.getCurrentDirectory()).toBe('sub_dir')
        expect(await galata.contents.fileExists('sub_dir/renamed_image.png')).toBeTruthy();
    });

    test('Go to home directory', async () => {
        await galata.filebrowser.openHomeDirectory();
    });

    test('File Explorer visibility', async () => {
        expect(await galata.filebrowser.isFileListedInBrowser('renamed_image.png')).toBeFalsy();
        await galata.filebrowser.revealFileInBrowser('sub_dir/renamed_image.png');
        expect(await galata.filebrowser.isFileListedInBrowser('renamed_image.png')).toBeTruthy();
    });

    test('Delete uploads', async () => {
        await galata.filebrowser.openHomeDirectory();
        await galata.contents.deleteDirectory('uploaded_dir');
        await galata.contents.deleteDirectory('sub_dir');
    });
});
