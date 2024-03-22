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
import * as vscode from 'vscode';
import { checkServerStatus } from '../../../commands/server/utils';
import { EventBus } from '../../../services/EventBus';
import { ServerStatus } from '../../../types/ServerInfoTypes';
import { INITIAL_ZENML_SERVER_STATUS } from '../../../utils/constants';
import { ServerTreeItem } from './ServerTreeItems';

export class ServerDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private static instance: ServerDataProvider | null = null;
  private currentStatus: ServerStatus = INITIAL_ZENML_SERVER_STATUS;
  private eventBus = EventBus.getInstance();

  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.subscribeToEvents();
  }


  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.off('refreshServerStatus', this.refresh);
    this.eventBus.on('refreshServerStatus', this.refresh);
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
    const serverStatus = await checkServerStatus();
    if (JSON.stringify(serverStatus) !== JSON.stringify(this.currentStatus)) {
      this.eventBus.emit('serverStatusUpdated', {
        isConnected: serverStatus.isConnected,
        serverUrl: serverStatus.url,
      });
    }

    this.currentStatus = serverStatus;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Gets the current status of the ZenML server.
   *
   * @returns {ServerStatus} The current status of the ZenML server, including connectivity, host, port, store type, and store URL.
   */
  public getCurrentStatus(): ServerStatus {
    return this.currentStatus;
  }

  /**
   * Retrieves the tree item for a given element, applying appropriate icons based on the server's connectivity status.
   *
   * @param element The tree item to retrieve.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    if (element instanceof ServerTreeItem) {
      if (element.serverStatus.isConnected) {
        element.iconPath = new vscode.ThemeIcon('vm-active');
      } else {
        element.iconPath = new vscode.ThemeIcon('vm-connect');
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
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (!element) {
      const updatedServerTreeItem = new ServerTreeItem('Server Status', this.currentStatus);
      if (this.currentStatus.isConnected) {
        return [updatedServerTreeItem];
      } else {
        return updatedServerTreeItem.children;
      }
    } else if (element instanceof ServerTreeItem) {
      return element.children;
    }
    return undefined;
  }
}
