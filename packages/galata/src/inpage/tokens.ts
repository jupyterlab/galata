// Copyright (c) Bloomberg Finance LP.
// Distributed under the terms of the Modified BSD License.

import {
    JupyterFrontEnd, IRouter
} from "@jupyterlab/application";

import {
    IDocumentManager
} from "@jupyterlab/docmanager";

import {
    ISettingRegistry
} from '@jupyterlab/settingregistry';

export
interface INotebookRunCallback {
    onBeforeScroll?: () => Promise<void>;
    onAfterScroll?: () => Promise<void>;
    onAfterCellRun?: (cellIndex: number) => Promise<void>;
}

export
interface IWaitForSelectorOptions {
    hidden?: boolean;
    // TODO add visible
}

export const PLUGIN_ID_ROUTER = '@jupyterlab/application-extension:router';
export const PLUGIN_ID_DOC_MANAGER = '@jupyterlab/docmanager-extension:plugin';
export const PLUGIN_ID_SETTINGS = '@jupyterlab/apputils-extension:settings';

export
interface IPluginNameToInterfaceMap {
    [PLUGIN_ID_ROUTER]: IRouter;
    [PLUGIN_ID_DOC_MANAGER]: IDocumentManager;
    [PLUGIN_ID_SETTINGS]: ISettingRegistry;
}

export
interface IGalataInpage {
    getPlugin<K extends keyof IPluginNameToInterfaceMap>(pluginId: K): Promise<IPluginNameToInterfaceMap[K] | undefined>;
    sleep(duration: number): Promise<void>;
    waitForLaunch(path?: string): Promise<void>;
    deleteNotebookCells(): Promise<void>;
    isNotebookCellSelected(cellIndex: number): boolean;
    saveActiveNotebook(): Promise<void>;
    runActiveNotebook(): Promise<void>;
    waitForNotebookRun(): Promise<void>;
    runActiveNotebookCellByCell(callback?: INotebookRunCallback): Promise<void>;
    getNotebookToolbarItemIndex(itemName: string): number;
    isElementVisible(el: HTMLElement): boolean;
    waitForSelector(selector: string, node?: Element, options?: IWaitForSelectorOptions): Promise<Node | void>;
    waitForXPath(selector: string, node?: Element, options?: IWaitForSelectorOptions): Promise<Node | void>;
    setTheme(themeName: string): Promise<void>;

    readonly app: JupyterFrontEnd;
}
