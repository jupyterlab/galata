# Galata
Galata is a JupyterLab UI Testing Framework that provides:
- **[Rich High Level API](packages/galata/src/jlabtest.ts)** to control and inspect JupyterLab UI programmatically
- **Testing Tools** for capture, comparison and report generation
- **[Command-line Interface (jlt)](packages/galata/bin/cli.js)** to manage tests, references and additional taks


## Compatibility
Galata is compatible with `JupyterLab 2.1`. It communicates with the JupyterLab using the lab object exposed to browser window (`window.lab`). The lab object is accessible when JupyterLab is launched with `--dev-mode` flag.

## build
lerna is required to build the project. Install lerna using
```
npm install --global lerna
```

Install dependencies and build
```
lerna bootstrap --hoist
lerna run build
```

For tests to be run, a JupyterLab instance must be up and running. Launch it without credentials. Tests expect to connect JupyterLab from `localhost:8888` by default. If a different URL is to be used, it can be specified using Galata's `--jlab-base-url` command line argument.
```
jupyter lab --dev-mode --no-browser --NotebookApp.token='' --NotebookApp.password='' --NotebookApp.disable_check_xsrf='True'
```

Galata uses `Headless Chrome` browser to launch JupyterLab and runs tests in. Chrome can be launched by Galata automatically. On Mac and Windows, Chrome is launched from default install locations. Chrome executable path can be specified using `--chrome-path` command line parameter as well.
Galata can also connect to Chrome via a remote debugging URL. It can be specified using `--chrome-url`.

## Running tests
There are two projects in this mono-repo. `galata` core project and `galata-example` project which is a boilerplate project that shows how `galata` can be integrated into a node project. Both of these projects contain some test suites that serve as unit tests and examples. You can run them using `lerna run test` or `npm run test` in each project's root directory.

## Configuration
Galata can be configured by using command line arguments or using `jltconfig.json` file. Full list of config options can be accessed using `jlt --help` (or `./node_modules/.bin/jlt --help` for a local installation). An example of config files is at [packages/galata/jltconfig.json](packages/galata/jltconfig.json)

## Acknowledgement
Development of this project began under [Bloomberg](https://github.com/bloomberg) organization, then it was transferred to [JupyterLab](https://github.com/jupyterlab) organization. We gratefully acknowledge **Bloomberg** for the generous contribution and supporting open-source software community.
