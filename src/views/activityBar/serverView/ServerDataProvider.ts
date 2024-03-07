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
import { ServerTreeItem } from './ServerTreeItems';
import {
  INITIAL_ZENML_SERVER_STATUS,
  ServerStatusService,
} from '../../../services/ServerStatusService';
import { ServerStatus } from '../../../types/ServerTypes';

/**
 * Manages data provisioning for the server status tree view within the Activity Bar.
 */
export class ServerDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private isActive: boolean = true;
  public serverStatusService: ServerStatusService;
  private currentServerStatus: ServerStatus = { ...INITIAL_ZENML_SERVER_STATUS };

  /**
   * Constructs a new ServerDataProvider instance.
   * Initializes the server status service and subscribes to server status updates to refresh the tree view.
   */
  constructor() {
    this.isActive = true;
    this.serverStatusService = ServerStatusService.getInstance();
    this.serverStatusService.subscribe(status => {
      this.currentServerStatus = status;
      this.refresh();
    });
  }

  /**
   * Resets the tree view data by setting isActive to false and emitting an event with 'undefined'.
   */
  public reset(): void {
    this.isActive = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Reactivates the tree view data by setting isActive to true.
   */
  public reactivate(): void {
    this.isActive = true;
  }

  /**
   * Updates the server status and triggers a UI refresh to reflect the latest server status.
   */
  public async refresh(): Promise<void> {
    if (!this.isActive) {
      console.log('ServerDataProvider is not active, skipping server status update.');
      return;
    } else {
      await this.serverStatusService.updateStatus();
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /**
   * Retrieves the tree item for a given element, applying appropriate icons based on the server's connectivity status.
   *
   * @param {vscode.TreeItem} element The tree item to be processed.
   * @returns {vscode.TreeItem} The processed tree item with updated icon if applicable.
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
   * @param {vscode.TreeItem} element The parent tree item. If undefined, fetches the server status.
   * @returns {Promise<vscode.TreeItem[] | undefined>} A promise that resolves to an array of child tree items or undefined if no children exist.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (!element) {
      return [new ServerTreeItem('Server Status', this.currentServerStatus)];
    } else if (element instanceof ServerTreeItem) {
      return element.children;
    }
    return undefined;
  }
}
