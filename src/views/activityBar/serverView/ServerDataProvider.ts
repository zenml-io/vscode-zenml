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
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
import { EventEmitter, ThemeIcon, TreeDataProvider, TreeItem } from 'vscode';
import { State } from 'vscode-languageclient';
import { checkServerStatus, isServerStatus } from '../../../commands/server/utils';
import { EventBus } from '../../../services/EventBus';
import { ServerStatus } from '../../../types/ServerInfoTypes';
import { INITIAL_ZENML_SERVER_STATUS, LSCLIENT_STATE_CHANGED, LSP_ZENML_CLIENT_INITIALIZED, REFRESH_SERVER_STATUS } from '../../../utils/constants';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { ServerTreeItem } from './ServerTreeItems';
import { ErrorTreeItem } from '../common/ErrorTreeItem';

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
    this.eventBus.on(LSCLIENT_STATE_CHANGED, (newState: State) => {
      if (newState === State.Running) {
        this.refresh();
      } else {
        this.currentStatus = [LOADING_TREE_ITEMS.get('lsClient')!]
        this._onDidChangeTreeData.fire(undefined);
      }
    })

    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, (isInitialized: boolean) => {
      this.zenmlClientReady = isInitialized;
      if (!isInitialized) {
        this.currentStatus = [LOADING_TREE_ITEMS.get('zenmlClient')!]
        this._onDidChangeTreeData.fire(undefined);
        return;
      }

      this.refresh();
      this.eventBus.off(REFRESH_SERVER_STATUS, async () => await this.refresh());
      this.eventBus.on(REFRESH_SERVER_STATUS, async () => await this.refresh());
    });
  }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {ServerDataProvider} The singleton instance.
   */
  public static getInstance(): ServerDataProvider {
    if (!this.instance) {
      this.instance = new ServerDataProvider();
    }
    return this.instance;
  }

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
    this.currentStatus = [LOADING_TREE_ITEMS.get('server')!]
    this._onDidChangeTreeData.fire(undefined);

    if (!this.zenmlClientReady) {
      this.currentStatus = [LOADING_TREE_ITEMS.get('zenmlClient')!]
      this._onDidChangeTreeData.fire(undefined);
      return;
    }

    const serverStatus = await checkServerStatus();
    if (isServerStatus(serverStatus)) {
      if (JSON.stringify(serverStatus) !== JSON.stringify(this.currentStatus)) {
        this.eventBus.emit('serverStatusUpdated', {
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
        element.iconPath = new ThemeIcon('vm-active');
      } else {
        element.iconPath = new ThemeIcon('vm-connect');
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
        console.log(this.currentStatus)
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