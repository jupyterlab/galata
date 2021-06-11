/* eslint-disable @typescript-eslint/ban-types */
// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import { JupyterFrontEnd, IRouter } from '@jupyterlab/application';

import { NotebookPanel, NotebookActions, Notebook } from '@jupyterlab/notebook';

import {
  IGalataInpage,
  INotebookRunCallback,
  IWaitForSelectorOptions,
  IPluginNameToInterfaceMap,
  PLUGIN_ID_ROUTER,
  PLUGIN_ID_DOC_MANAGER
} from './tokens';

import { Cell, MarkdownCell } from '@jupyterlab/cells';

import * as nbformat from '@jupyterlab/nbformat';

import { toArray } from '@lumino/algorithm';

function xpContainsClass(className: string): string {
  return `contains(concat(" ", normalize-space(@class), " "), " ${className} ")`;
}

export class GalataInpage implements IGalataInpage {
  constructor() {
    this._app = window.jupyterlab;
  }

  async getPlugin<K extends keyof IPluginNameToInterfaceMap>(
    pluginId: K
  ): Promise<IPluginNameToInterfaceMap[K] | undefined> {
    return new Promise((resolve, reject) => {
      const app = this._app;
      const hasPlugin = app.hasPlugin(pluginId);

      if (hasPlugin) {
        try {
          const appAny = app as any;
          const plugin: any = appAny._pluginMap
            ? appAny._pluginMap[pluginId]
            : undefined;
          if (plugin.activated) {
            resolve(plugin.service);
          } else {
            app.activatePlugin(pluginId).then(response => {
              resolve(plugin.service);
            });
          }
        } catch (error) {
          console.error('Failed to get plugin', error);
        }
      }
    });
  }

  async sleep(duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  async waitForFunction(fn: Function, timeout?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let checkTimer;
      let timeoutTimer;
      const check = async () => {
        checkTimer = null;
        if (await Promise.resolve(fn())) {
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
          }
          resolve();
        } else {
          checkTimer = setTimeout(check, 200);
        }
      };

      check();

      if (timeout) {
        timeoutTimer = setTimeout(() => {
          timeoutTimer = null;
          if (checkTimer) {
            clearTimeout(checkTimer);
          }
          reject(new Error('Timed out waiting for condition to be fulfilled.'));
        }, timeout);
      }
    });
  }

  async waitForDuration(duration: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  async waitFor(condition: Function | number, timeout?: number): Promise<void> {
    const conditionType = typeof condition;

    if (conditionType === 'function') {
      return this.waitForFunction(condition as Function, timeout);
    } else if (conditionType === 'number') {
      return this.waitForDuration(condition as number);
    }
  }

  async waitForLaunch(path = '/lab'): Promise<void> {
    let resolver: () => void;
    const delegate = new Promise<void>(resolve => {
      resolver = resolve;
    });
    const router = await this.getPlugin(PLUGIN_ID_ROUTER);
    const docManager = await this.getPlugin(PLUGIN_ID_DOC_MANAGER);

    router.routed.connect(async (sender: IRouter, args: IRouter.ILocation) => {
      if (args.path === path) {
        await docManager.closeAll();
        resolver();
      }
    });
    return delegate;
  }

  async waitForSelector(
    selector: string,
    node?: Element,
    options?: IWaitForSelectorOptions
  ): Promise<Node | void> {
    const waitForHidden = options && options.hidden;

    return new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        const parent = node || document;
        const found = parent.querySelector(selector);
        if (waitForHidden) {
          if (!found) {
            clearInterval(timer);
            resolve();
          }
        } else if (found) {
          clearInterval(timer);
          resolve(found);
        }
      }, 200);
    });
  }

  async waitForXPath(
    selector: string,
    node?: Element,
    options?: IWaitForSelectorOptions
  ): Promise<Node | void> {
    const waitForHidden = options && options.hidden;

    return new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        const parent = node || document;
        const iterator = document.evaluate(
          selector,
          parent,
          null,
          XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
          null
        );
        const found = iterator && iterator.iterateNext();
        if (waitForHidden) {
          if (!found) {
            clearInterval(timer);
            resolve();
          }
        } else if (found) {
          clearInterval(timer);
          resolve(found);
        }
      }, 200);
    });
  }

  async deleteNotebookCells(): Promise<void> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const nb = nbPanel.content;

    NotebookActions.deleteCells(nb);

    nb.update();
  }

  async addNotebookCell(
    cellType: nbformat.CellType,
    source: string
  ): Promise<boolean> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const nb = nbPanel.content;

    NotebookActions.insertBelow(nb);

    const numCells = nb.widgets.length;

    nb.model.cells.beginCompoundOperation();
    nb.model.cells.set(
      numCells - 1,
      nb.model.contentFactory.createCell(cellType, {
        cell: {
          cell_type: cellType,
          source: source,
          metadata: {}
        }
      })
    );
    nb.model.cells.endCompoundOperation();
    nb.update();

    return true;
  }

  async setNotebookCell(
    cellIndex: number,
    cellType: nbformat.CellType,
    source: string
  ): Promise<boolean> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const nb = nbPanel.content;

    const numCells = nb.widgets.length;
    if (cellIndex < 0 || cellIndex >= numCells) {
      return false;
    }

    nb.model.cells.beginCompoundOperation();
    nb.model.cells.set(
      cellIndex,
      nb.model.contentFactory.createCell(cellType, {
        cell: {
          cell_type: cellType,
          source: source,
          metadata: {}
        }
      })
    );
    nb.model.cells.endCompoundOperation();
    nb.update();

    return true;
  }

  isNotebookCellSelected(cellIndex: number): boolean {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const nb = nbPanel.content;

    const numCells = nb.widgets.length;
    if (cellIndex < 0 || cellIndex >= numCells) {
      return false;
    }

    return nb.isSelected(nb.widgets[cellIndex]);
  }

  async saveActiveNotebook(): Promise<void> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    await nbPanel.context.save();
  }

  async runActiveNotebook(): Promise<void> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;

    await NotebookActions.runAll(nbPanel.content);
  }

  async waitForNotebookRun(): Promise<void> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const notebook = nbPanel.content;
    if (!notebook.widgets) {
      console.error('NOTEBOOK CELL PROBLEM', notebook);
    }
    const numCells = notebook.widgets.length;

    if (numCells === 0) {
      return;
    }

    const promises: Promise<Node>[] = [];

    for (let i = 0; i < numCells; ++i) {
      const cell = notebook.widgets[i];
      promises.push(this.waitForCellRun(cell));
    }

    await Promise.all(promises);
  }

  async waitForMarkdonCellRendered(cell: MarkdownCell): Promise<void> {
    await cell.ready;

    let resolver: (value: void | PromiseLike<void>) => void;
    const delegate = new Promise<void>(resolve => {
      resolver = resolve;
    });
    let timer = setInterval(() => {
      if (cell.rendered) {
        clearInterval(timer);
        timer = null;
        resolver();
      }
    }, 200);

    return delegate;
  }

  async waitForCellRun(cell: Cell, timeout = 2000): Promise<Node | null> {
    const model = cell.model;
    const code = model.value.text;
    if (!code.trim()) {
      return null;
    }

    const emptyPrompt = '[ ]:';
    const runningPrompt = '[*]:';

    await this.waitForXPath(
      `.//div[${xpContainsClass(
        'jp-InputArea-prompt'
      )} and text()="${emptyPrompt}"]`,
      cell.node,
      { hidden: true }
    );
    await this.waitForXPath(
      `.//div[${xpContainsClass(
        'jp-InputArea-prompt'
      )} and text()="${runningPrompt}"]`,
      cell.node,
      { hidden: true }
    );

    const cellType = cell.model.type;
    if (cellType === 'markdown') {
      await this.waitForMarkdonCellRendered(cell as MarkdownCell);
      return null;
    } else if (cellType === 'raw') {
      return null;
    } else {
      // 'code'
      let resolver: (value: Node | null) => void;
      const delegate = new Promise<Node | null>(resolve => {
        resolver = resolve;
      });

      let numTries = 0;
      let timer: any = null;
      let timeoutTimer: any = null;

      const clearAndResolve = (output: Node | null) => {
        clearInterval(timer);
        timer = null;
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
        resolver(output);
      };

      const startTimeout = () => {
        if (!timeoutTimer) {
          timeoutTimer = setTimeout(() => {
            clearAndResolve(null);
          }, timeout);
        }
      };

      const checkIfDone = () => {
        const output = cell.node.querySelector(
          '.jp-Cell-outputArea .jp-OutputArea-output'
        );

        if (output) {
          if (output.textContent === 'Loading widget...') {
            startTimeout();
          } else {
            clearAndResolve(output);
          }
        } else {
          if (numTries > 0) {
            clearAndResolve(null);
          }
        }
        numTries++;
      };

      checkIfDone();

      timer = setInterval(() => {
        checkIfDone();
      }, 200);
      return delegate;
    }
  }

  notebookWillScroll(
    notebook: Notebook,
    position: number,
    threshold = 25
  ): boolean {
    const node = notebook.node;
    const ar = node.getBoundingClientRect();
    const delta = position - ar.top - ar.height / 2;
    return Math.abs(delta) > (ar.height * threshold) / 100;
  }

  async runActiveNotebookCellByCell(
    callback?: INotebookRunCallback
  ): Promise<void> {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const notebook = nbPanel.content;
    if (!notebook.widgets) {
      console.error('NOTEBOOK CELL PROBLEM', notebook);
    }
    const numCells = notebook.widgets.length;

    if (numCells === 0) {
      return;
    }

    NotebookActions.deselectAll(notebook);

    for (let i = 0; i < numCells; ++i) {
      const cell = notebook.widgets[i];
      notebook.activeCellIndex = i;
      notebook.select(cell);

      await NotebookActions.run(notebook, nbPanel.context.sessionContext);

      const output = await this.waitForCellRun(cell);

      if (callback && callback.onAfterCellRun) {
        await callback.onAfterCellRun(i);
      }

      const rectNode = output
        ? cell.node.querySelector('.jp-Cell-outputArea')
        : cell.inputArea.node;
      const rect = rectNode.getBoundingClientRect();

      const scrollThreshold = 45;
      const willScroll = this.notebookWillScroll(
        notebook,
        rect.bottom,
        scrollThreshold
      );
      if (willScroll && callback && callback.onBeforeScroll) {
        await callback.onBeforeScroll();
      }

      const prevScroll = notebook.node.scrollTop;
      notebook.scrollToPosition(rect.bottom, scrollThreshold);
      notebook.update();

      if (willScroll && callback && callback.onAfterScroll) {
        const newScroll = notebook.node.scrollTop;
        if (newScroll !== prevScroll) {
          console.error('Notebook scroll mispredicted!');
        }

        await callback.onAfterScroll();
      }
    }
  }

  getNotebookToolbarItemIndex(itemName: string): number {
    const nbPanel = this._app.shell.currentWidget as NotebookPanel;
    const names = toArray(nbPanel.toolbar.names());

    return names.indexOf(itemName);
  }

  isElementVisible(el: HTMLElement): boolean {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  async setTheme(themeName: string): Promise<void> {
    await this._app.commands.execute('apputils:change-theme', {
      theme: themeName
    });

    await this.waitFor(async () => {
      return document.body.dataset.jpThemeName === themeName;
    });
  }

  get app(): JupyterFrontEnd {
    return this._app;
  }

  private _app: JupyterFrontEnd;
}

window.galataip = new GalataInpage();
