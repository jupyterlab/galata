<h1 align="center">
  <p align="center">Galata<a href="#about-galata-name">*</a></p>
  <img
      alt="Galata"
      src="./media/galata-logo.svg"
      width="150"
    />
</h1>


## Archived

**This project is archived. Development is now happening in https://github.com/jupyterlab/jupyterlab**.

---

Galata is a JupyterLab UI Testing Framework that provides:
- **[Rich High Level API](packages/galata/src/galata.ts)** to control and inspect JupyterLab UI programmatically
- **Testing Tools** for capture, comparison and report generation
- **[Command-line Interface (galata)](packages/galata/bin/cli.js)** to manage tests, references and additional tasks

![screencast](media/screencast.gif)

## Getting Started

The galata repo contains an example test project that you can use to start writing UI test suites. Simply launch JupyterLab and run the `test` script after building the example project.

### Launch JupyterLab
```bash
jupyter lab --expose-app-in-browser --no-browser --ServerApp.token='' --ServerApp.password='' --ServerApp.disable_check_xsrf='True'
```

### Build and run test project

```bash
# clone Galata repo
git clone https://github.com/jupyterlab/galata.git

# cd into galata-example project
cd galata/packages/galata-example

# install dependencies
yarn

# build
yarn run build

# run test suites using `test` script which calls `galata` CLI script
yarn run test
```

Galata should generate console output similar to following

```bash
 PASS  tests/test.test.ts (6.485s)
  A Test Suite
    ✓ A test (3ms)

```

You can edit the test suite file [`galata-example/tests/test.test.ts`](packages/galata-example/tests/test.test.ts) or add more test suites to the [`galata-example/tests`](packages/galata-example/tests/) directory. You can pass additional [command-line options](#command-line-options) to Galata by appending them to the `yarn run test` command such as `yarn run test -- --no-headless`.

Additional test suite examples are available in [`galata/tests`](packages/galata/tests/). They contain examples of creating notebooks, uploading notebooks to JupyterLab, running notebooks and taking screenshots.

## Architectural Overview
Galata loads `JupyterLab` in headless browser and interacts with it using `playwright` library. Since playwright can be quite low level for a lot of users and JupyterLab code-base knowledge is required to interact with JupyterLab UI, Galata provides a high level API that makes interacting with JupyterLab UI much easier. Galata is designed to be used with `jest`. It customizes jest environment configuration to manage JupyterLab runtime automatically so that users can focus on only writing their test cases.

## Compatibility
Galata is compatible with `JupyterLab 3`. It communicates with the JupyterLab using the *jupyterlab: JupyterFrontEnd* object exposed to browser window (`window.jupyterlab`). The *jupyterlab: JupyterFrontEnd* object is accessible when JupyterLab is launched with `--expose-app-in-browser` flag.

## Versioning
Galata package is versioned with the same major, minor and patch versions as the JupyterLab it is made for. For example, if Galata is based on JupyterLab 3.0.1, a valid Galata version is 3.0.1-1 to 3.0.1-n. This version matching is enforced before Galata packages are published, for consistency.

## Build

Install dependencies and build
```
yarn
yarn run build
```

For tests to be run, a JupyterLab instance must be up and running. Launch it without credentials. Tests expect to connect JupyterLab from `localhost:8888` by default. If a different URL is to be used, it can be specified using Galata's `--jlab-base-url` command line argument. If your tests are modifying files (upload / rename / delete), or taking captures that include file explorer then it is suggested to launch JupyterLab from inside an empty directory.
```
jupyter lab --expose-app-in-browser --no-browser --ServerApp.token='' --ServerApp.password='' --ServerApp.disable_check_xsrf='True'
```

Galata uses headless browser to launch JupyterLab and runs tests in. Browser can be launched by Galata automatically.
Galata can also connect to Browser via a remote debugging URL. It can be specified using `--browser-url`.

## Running tests
There are two projects in this mono-repo. `galata` core project and `galata-example` project which is a boilerplate project that shows how `galata` can be integrated into a node project. Both of these projects contain some test suites that serve as unit tests and examples. You can run them using `lerna run test` or `yarn run test` in each project's root directory. It is suggested to run tests in each projects directory as below. Otherwise you need to run `lerna run test --stream` to see detailed result of each test in a test suite.

```
cd packages/galata
yarn run test
```

## Configuration
Galata can be configured by using command line arguments or using `galata-config.json` file. Full list of config options can be accessed using `galata --help` (or `./node_modules/.bin/galata --help` for a local installation). An example of config files is at [packages/galata/galata-config.json](packages/galata/galata-config.json)

## Command-line Options
Galata provides a command-line interface (`galata`) to manage tests, references and execute additional tasks. Below is the list of these command-line arguments that can be passed to `galata` with detailed information on each.

Notes:
1. Argument values can be set using a space between name and value, or an equal sign in-between. For example: `galata --result-server true` is same as `galata --result-server=true`.
2. For boolean typed arguments, a value of `true` doesn't need to be specified and they can be negated by adding `no-` as prefix. For example: `galata --result-server` is same as `galata --result-server true`. Also, `galata --no-result-server` is same as `galata --result-server false`.


#### **Usage**

    $ galata <test_files> <options>

    <test_files>: Optional. Regular expression pattern to match test files to run. Has the same properties as --test-path-pattern option described below.

    <options>: Optional. List of arguments as described below.

#### **Options**

- **--browser-type**: Browser type to use for running tests

    Galata can run tests in three different type of browsers: `chromium`, `firefox` and `webkit`.

    *Default*: 'chromium'

- **--browser-path**: Browser executable path

    Browser executable path to use when launching a browser, instead of using browser installed by playwright. Browser type must match the type of browser being launched from this path.

    *Default*: ''

- **--browser-url**: Browser remote debugging URL

    If specified, Galata connects to Browser using this URL, instead of launching a new Browser instance. Browser type must match the type of browser being connected with this URL.

    *Default*: ''

- **--test-path-pattern**: Regular expression pattern to match test files to run.

    *Default*: `^.*/tests/.*[ts,js]$` which resolves all `.ts` and `.js` test suite files under `tests` directory, including sub-directories.

- **--jlab-base-url**: JupyterLab base URL

    Base URL to access JupyterLab.

    *Default*: `http://localhost:8888`

- **--jlab-token**: JupyterLab authentication token

    Authentication token to use when connecting to JupyterLab

    *Default*: `''`

- **--jest-config**: jest configuration file

    Path to configuration file for jest. If specified, it should contain the preset as `preset: './node_modules/@jupyterlab/galata/jest.config.js'` (relative path to Galata's jest.config.js) so that default Galata jest configuration is applied first.

    *Default*: `''`

- **--jest-path**: jest executable path

    Path to jest executable.

    *Default*: `./node_modules/.bin/jest`

- **--headless**: Flag to enable browser headless mode

    Can be negated using `--no-headless`

    *Default*: `true`

- **--page-width**: Browser page width in pixels

    *Default*: `1024`

- **--page-height**: Browser page height in pixels

    *Default*: `768`

- **--include**: Test suites to include

    Comma separated list of test suite names to include in run. Suffix `.test.ts` can be omitted. E.g. `test1,test2` or `test1.test.ts,test2.test.ts`. If specified, only test suites in this list are run. Cannot be combined with `--exclude`, and if both specified, `--exclude` is ignored.

    *Default*: `[]`, which will include all test suites

- **--exclude**: Test suites to exclude

    Comma separated list of test suite names exclude in run. Suffix `.test.ts` can be omitted. E.g. `test1,test2` or `test1.test.ts,test2.test.ts`. If specified, test suites in this list are excluded from run. Cannot be combined with `--include`.

    *Default*: `[]`, which will not exclude any test suites

- **--skip-visual-regression**: Flag to skip visual regression tests

    If set to true, any image capture comparison will pass without comparing. This feature can be used for debugging purposes or when reference files are not available. Can be negated using `--no-skip-visual-regression`

    *Default*: `false`

- **--skip-html-regression**: Flag to skip HTML regression tests

    If set to true, any HTML capture comparison will pass without comparing. This feature can be used for debugging purposes or when reference files are not available. Can be negated using `--no-skip-html-regression`

    *Default*: `false`

- **--discard-matched-captures**: Delete test captures when matching with reference

    If set to true, image and HTML captures that were used in a comparison are deleted when there is no difference with the reference file. This flag provides an optimization by deleting captures which don't produce any diff. Can be negated using `--no-discard-matched-captures`

    *Default*: `true`

- **--output-dir**: Result output directory

    Directory to output test results. Each `galata` run produces several test output files including test captures and report files. They are stored in `{output-dir}/{test-id}` directory

    *Default*: `./test-output`

- **--test-id**: Custom test id to use

    If specified, test run is given this test-id. It controls directory where test result files are stored within `output-dir` (they are stored in `{output-dir}/{test-id}`), and it is presented in test result report. By default, test-id is auto generated from current date time.

    *Default*: Current date time in `yyyy-mm-dd_HH-MM-ss` format.

- **--reference-dir**: Reference output directory

    Directory which contains reference image and HTML files. Images are expected to be in `{reference-dir}/screenshots` and HTML files are expected to be in `{reference-dir}/html`

    *Default*: `./reference-output`

- **--result-server**: Launch result file server when tests finished

    If set to true, launches an HTTP file server at `http://localhost:8080`. Can be negated using `--no-result-server`.

    *Default*: `false`

- **--open-report**: Open result report

    If set to true, opens the test result report URL at `http://localhost:8080/report/index.html` using system's default browser. Only has effect when `--result-server` is toggled. Can be negated using `--no-open-report`.

    *Default*: `true`

- **--image-match-threshold**: Image matching threshold

    Sets the image match threshold used during captured image's comparison with reference image. This parameter is passed to [pixelmatch](https://github.com/mapbox/pixelmatch) library that is used as the comparison tool. It can be a value between `0` and `1`, higher values allowing more tolerance in image comparison.

    *Default*: `0.1`

- **--slow-mo**: Slow down UI operations by the specified ms

    If specified, playwright operations are slowed down by the specified milliseconds. Can be used for debugging tests.

    *Default*: `0`

- **--launch-result-server**: Launch result file server for a test

    Launches result server for a previously run test, so that test result output and report can be accessed from a URL. By default opens test result report as well. When its value is set to `latest` it finds the latest run test in `{output-dir}` by sorting them by name. This way of sorting works well if `test-id`s are set using the default logic of date time based id format. A test id can be set as the value of this argument (`--launch-result-server {test-id}`), and in that case result server will be serving test output for that particular test's results. Skips test execution.

    *Default*: `latest`

- **--update-references**: Update reference files from a test's output

    Updates reference files using a previous run's output files. It doesn't remove existing reference files, but replaces if a reference file with same name exists. Images from `{test-id}/screenshots` are copied into `{reference-dir}/screenshots` and HTML files from `{test-id}/html` are copied into `{reference-dir}/html`. A test id can be set as the value of this argument (`--update-references {test-id}`). Default value is `latest` and same logic is used as described in `--launch-result-server` to find the latest test run. Skips test execution.

    *Default*: `latest`

- **--delete-references**: Flag to delete all reference files

    Deletes all reference files in `{reference-dir}`. Skips test execution.

    *Default*: `false`

- **--max-wait**: Maximum time (in ms) to wait for JupyterLab to load

    *Default*: `5000`

- **--help**: Show usage information

    Shows usage information with list of all command-line options. Skips test execution.

- **--version**: Show version information

    Shows version information of command-line tool. Skips test execution.

```
Examples

    $ galata --jlab-base-url http://localhost:8888
    $ galata --browser-url http://localhost:9222 --jlab-base-url http://localhost:8888
    $ galata ./ui-tests/*.test.ts
    $ galata --exclude contents
    $ galata --include notebook,contents
    $ galata --include [notebook,contents]
    $ galata --launch-result-server
    $ galata --launch-result-server --no-open-report
    $ galata --delete-references
    $ galata --update-references 2020-08-22_14-01-30
```

## Reference Image Captures

When doing visual regression tests, it is important to use reference images that were generated in the same environment. Otherwise, even though the same browser is used for testing, there might be minor differences in image renderings generated that could cause visual regression tests to fail.

When adding a new visual regression test, first make sure your tests pass locally on your development environment, with a reference image generated in your dev environment. You can use images captured by Galata as reference images. They will be saved as part of test output, under `test-output/<test-id>/screenshots`. However, you shouldn't push these references images generated in your development environment to github. Instead, have the new regression tests run and fail by GitHub Actions first, then download the artifacts from GitHub and use the captures generated in GitHub testing environment as the reference images and push those in a separate commit.

## Community Guidelines and Code of Conduct

This repository is a Jupyter project and follows the Jupyter
[Community Guides and Code of Conduct](https://jupyter.readthedocs.io/en/latest/community/content-community.html).

## About Galata Name

Galata framework is named after [Galata Tower](https://en.wikipedia.org/wiki/Galata_Tower) in Istanbul. Centuries ago, Galata Tower was used to spot fires in the city. Tower was also used as astronomical observatory in the past.

## Acknowledgement

Development of this project began under [Bloomberg](https://github.com/bloomberg) organization by [Mehmet Bektas](https://github.com/mbektas), then it was transferred to [JupyterLab](https://github.com/jupyterlab) organization. We gratefully acknowledge **Bloomberg** for the generous contribution and supporting open-source software community.
