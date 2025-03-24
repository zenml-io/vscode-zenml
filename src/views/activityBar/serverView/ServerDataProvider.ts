// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing
// permissions and limitations under the License.
import { EventEmitter, TreeDataProvider, TreeItem } from 'vscode';
import { State } from 'vscode-languageclient';
import { checkServerStatus, isServerStatus } from '../../../commands/server/utils';
import { EventBus } from '../../../services/EventBus';
import { ServerStatus } from '../../../types/ServerInfoTypes';
import {
  INITIAL_ZENML_SERVER_STATUS,
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  SERVER_STATUS_UPDATED,
} from '../../../utils/constants';
import { TREE_ICONS } from '../../../utils/ui-constants';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { ServerTreeItem } from './ServerTreeItems';

export class ServerDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private static instance: ServerDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  private currentStatus: ServerStatus | TreeItem[] = INITIAL_ZENML_SERVER_STATUS;

  constructor() {
    this.subscribeToEvents();
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);

    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
  }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {ServerDataProvider} The singleton instance.
   */
  public static getInstance(): ServerDataProvider {
    if (!ServerDataProvider.instance) {
      ServerDataProvider.instance = new ServerDataProvider();
    }
    return ServerDataProvider.instance;
  }

  /**
   * Triggers the loading state for a given entity.
   *
   * @param {string} entity The entity to trigger the loading state for.
   */
  private triggerLoadingState = (entity: string) => {
    this.currentStatus = [LOADING_TREE_ITEMS.get(entity)!];
    this._onDidChangeTreeData.fire(undefined);
  };

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private lsClientStateChangeHandler = (status: State) => {
    if (status !== State.Running) {
      this.triggerLoadingState('lsClient');
    } else {
      this.refresh();
    }
  };

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isInitialized The new ZenML client state.
   */
  private zenmlClientStateChangeHandler = (isInitialized: boolean) => {
    this.zenmlClientReady = isInitialized;
    if (!isInitialized) {
      this.triggerLoadingState('zenmlClient');
    } else {
      this.refresh();
    }
  };

  /**
   * Updates the server status to the provided status (used for tests).
   *
   * @param {ServerStatus} status The new server status.
   */
  public updateStatus(status: ServerStatus): void {
    this.currentStatus = status;
  }

  /**
   * Updates the server status and triggers a UI refresh to reflect the latest server status.
   * If the server status has changed, it emits a serverStatusUpdated event.
   *
   * @returns {Promise<void>} A promise resolving to void.
   */
  public async refresh(): Promise<void> {
    this.triggerLoadingState('server');

    if (!this.zenmlClientReady) {
      this.triggerLoadingState('zenmlClient');
      return;
    }

    const serverStatus = await checkServerStatus();
    if (isServerStatus(serverStatus)) {
      if (JSON.stringify(serverStatus) !== JSON.stringify(this.currentStatus)) {
        this.eventBus.emit(SERVER_STATUS_UPDATED, {
          isConnected: serverStatus.isConnected,
          serverUrl: serverStatus.url,
        });
      }
    }

    this.currentStatus = serverStatus;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Gets the current status of the ZenML server.
   *
   * @returns {ServerStatus} The current status of the ZenML server, including connectivity, host, port, store type, and store URL.
   */
  public getCurrentStatus(): ServerStatus | TreeItem[] {
    return this.currentStatus;
  }

  /**
   * Retrieves the tree item for a given element, applying appropriate icons based on the server's connectivity status.
   *
   * @param element The tree item to retrieve.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: TreeItem): TreeItem {
    if (element instanceof ServerTreeItem) {
      if (element.serverStatus.isConnected) {
        element.iconPath = TREE_ICONS.SERVER_CONNECTED;
      } else {
        element.iconPath = TREE_ICONS.SERVER_DISCONNECTED;
      }
    }
    return element;
  }

  /**
   * Asynchronously fetches the children for a given tree item.
   *
   * @param element The parent tree item. If undefined, the root server status is fetched.
   * @returns A promise resolving to an array of child tree items or undefined if there are no children.
   */
  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      if (isServerStatus(this.currentStatus)) {
        const updatedServerTreeItem = new ServerTreeItem('Server Status', this.currentStatus);
        return [updatedServerTreeItem];
      } else if (Array.isArray(this.currentStatus)) {
        return this.currentStatus;
      }
    } else if (element instanceof ServerTreeItem) {
      return element.children;
    }
    return undefined;
  }

  /**
   * Retrieves the server version.
   *
   * @returns The server version.
   */
  public getServerVersion(): string {
    if (isServerStatus(this.currentStatus)) {
      return this.currentStatus.version;
    }
    return 'N/A';
  }
}
