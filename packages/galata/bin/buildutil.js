#! /usr/bin/env node

// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const meow = require('meow');
const fs = require('fs-extra');
const path = require('path');

const cli = meow(`
    Usage
      $ jlt-buildutil <options>

    Options
      --save-jlab-version       save JupyterLab version into metadata

    Other options:
      --help                    show usage information
      --version                 show version information

    Examples
      $ jlt-buildutil --save-jlab-version
`, {
    flags: {
        saveJlabVersion: {
            type: 'boolean',
            default: false
        }
    }
});


function addToMetadata(data) {
    const metadataFilePath = path.resolve(__dirname, './metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataFilePath)) {
        try {
            metadata = fs.readJSONSync(metadataFilePath);
        } catch {
        }
    }

    metadata = { ...metadata, ...data };

    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata));
}

if (cli.flags.saveJlabVersion) {
    const packageFilePath = path.resolve(__dirname, '../../../package-lock.json');
    const packageFileData = fs.existsSync(packageFilePath) ? fs.readJSONSync(packageFilePath) : undefined;
    if (!packageFileData) {
        console.log('package-lock.json not found!');
        process.exit(1);
    }

    if (!(packageFileData['dependencies'] && packageFileData['dependencies']['@jupyterlab/application'])) {
        console.log('@jupyterlab/application package not found!');
        process.exit(1);
    }

    const jlabPackage = packageFileData['dependencies']['@jupyterlab/application'];
    const jlabVersion = jlabPackage['version'];

    console.log(`JupyterLab version: ${jlabVersion}`);

    addToMetadata({ jlabVersion: jlabVersion });
}
