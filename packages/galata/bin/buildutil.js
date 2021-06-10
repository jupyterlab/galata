#! /usr/bin/env node

// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

const meow = require('meow');
const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');
const lockfile = require('@yarnpkg/lockfile');

const cli = meow(`
    Usage
      $ galata-buildutil <options>

    Options
      --save-jlab-version       save JupyterLab version into metadata
      --enforce-version-match   enforce matching Galata and JupyterLab versions

    Other options:
      --help                    show usage information
      --version                 show version information

    Examples
      $ galata-buildutil --save-jlab-version
`, {
    flags: {
        saveJlabVersion: {
            type: 'boolean',
            default: false
        },
        enforceVersionMatch: {
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
    const packageFilePath = path.resolve(__dirname, '../../../yarn.lock');
    if (!fs.existsSync(packageFilePath)) {
        console.log('yarn.lock not found!');
        process.exit(1);
    }

    const yarnLock = fs.readFileSync(packageFilePath, 'utf8');
    const json = lockfile.parse(yarnLock);
    const packages = Object.keys(json.object);
    const jlab = packages.find(pkg => pkg.startsWith('@jupyterlab/application'));
    if (!jlab) {
        console.log('@jupyterlab/application package not found!');
        process.exit(1);
    }

    const jlabVersion = jlab.version;
    console.log(`JupyterLab version: ${jlabVersion}`);

    addToMetadata({ jlabVersion });
}

if (cli.flags.enforceVersionMatch) {
    const packageFilePath = path.resolve(__dirname, '../package.json');
    const packageFileData = fs.existsSync(packageFilePath) ? fs.readJSONSync(packageFilePath) : undefined;
    if (!packageFileData) {
        console.log('package.json not found!');
        process.exit(1);
    }

    const galataVersion = packageFileData['version'];

    const metadataFilePath = path.resolve(__dirname, './metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataFilePath)) {
        try {
            metadata = fs.readJSONSync(metadataFilePath);
        } catch {
        }
    }

    const jlabVersion = metadata['jlabVersion'];

    if (!semver.valid(galataVersion) || !semver.valid(jlabVersion) ||
        semver.major(galataVersion) !== semver.major(jlabVersion) ||
        semver.minor(galataVersion) !== semver.minor(jlabVersion) ||
        semver.patch(galataVersion) !== semver.patch(jlabVersion)
    ) {
        console.log(`Galata package version ${galataVersion} doesn't match target JupyterLab version ${jlabVersion}`);
        process.exit(1);
    }

    process.exit(0);
}
