# Galata
JupyterLab UI Testing Framework

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

For tests to be run, a JupyterLab instance must be up and running. Launch it without credentials. Tests expect to connect JupyterLab from `localhost:8888`
```
jupyter lab --no-browser --NotebookApp.token='' --NotebookApp.password='' --NotebookApp.disable_check_xsrf='True'
```

## Acknowledgement
Development of this project began under [Bloomberg](https://github.com/bloomberg) organization, then it was transferred to [JupyterLab](https://github.com/jupyterlab) organization. We gratefully acknowledge **Bloomberg** for the generous contribution and supporting open-source software community.
