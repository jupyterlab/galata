# Making a Galata Release

1. Bump the Galata version in [packages/galata/package.json](packages/galata/package.json). Also update example project's Galata dependency version to match, in [packages/galata-example/package.json](packages/galata-example/package.json).

    Galata package needs to be versioned with the same major, minor and patch versions as the JupyterLab it is made for. For example, if Galata is based on JupyterLab 3.0.1, a valid Galata version is 3.0.1-1 to 3.0.1-n. This version matching is enforced before Galata packages are published.

    JupyterLab version, that Galata is made for, is determined by  `@jupyterlab/application` dependency version in the [yarn.lock](yarn.lock). If the JupyterLab version is not changing with the new Galata release then only increment the release number after `-` (for example `3.0.1-2` to `3.0.1-3`). However, if JupyterLab version is changing with the new Galata release then reset the release number after `-` to 1 (for example `3.0.1-3` to `3.0.2-1`).

2. Re-install dependencies and rebuild.

```
lerna bootstrap --hoist
lerna run build
```

3. Run tests and make sure that all pass. Before running tests, JupyterLab must be up and running. You can use the launch command described in `Launch JupyterLab` section of [README.md](README.md#launch-jupyterlab)

```
lerna run test --stream
```

4. Commit your version changes.

5. Once version update is in the `main` branch, publish a new release on GitHub (https://github.com/jupyterlab/galata/releases) with the list of changes in the description.

6. Pull latest of `main` branch and publish npm package to npm registry. You will need an npmjs.org account to be able to publish this package.

```
cd packages/galata
npm login --registry https://registry.npmjs.org
npm publish
```
