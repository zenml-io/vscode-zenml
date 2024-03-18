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
import { getActiveStack } from '../../commands/stack/utils';
import { EventBus } from '../../services/EventBus';
import { ZenServerDetails } from '../../types/ServerInfoTypes';
import { showErrorMessage } from '../../utils/notifications';

/**
 * Represents the ZenML extension's status bar.
 * This class manages two main status indicators: the server status and the active stack name.
 */
export default class ZenMLStatusBar {
  private static instance: ZenMLStatusBar;
  private serverStatusItem: vscode.StatusBarItem;
  private activeStackItem: vscode.StatusBarItem;
  private activeStack: string = 'Loading...';
  private eventBus = EventBus.getInstance();

  /**
   * Initializes a new instance of the ZenMLStatusBar class.
   * Sets up the status bar items for server status and active stack, subscribes to server status updates,
   * and initiates the initial refresh of the status bar state.
   */
  constructor() {
    this.serverStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.activeStackItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.subscribeToEvents();
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the status bar.
   *
   * @returns void
   */
  private subscribeToEvents(): void {
    this.eventBus.on('serverConfigUpdated', async ({ updatedServerConfig }) => {
      this.sync(updatedServerConfig);
      await this.refreshActiveStack();
    });

    this.eventBus.on('serverStatusUpdated', ({ isConnected, serverUrl }) => {
      this.updateServerStatusIndicator(isConnected, serverUrl);
    });
  }

  /**
   * Shows a loading indicator in the status bar and syncs the status bar with the updated server configuration.
   *
   * @param {ZenServerDetails} [updatedServerConfig] The updated server configuration from the LSP server.
   */
  private async sync(updatedServerConfig: ZenServerDetails): Promise<void> {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: 'ZenML config change detected. Syncing.',
      }, async (progress) => {
        progress.report({ increment: 0 });

        const isConnected = updatedServerConfig.storeConfig.type === 'rest';
        this.updateServerStatusIndicator(isConnected, updatedServerConfig.storeConfig.url);
        await this.refreshActiveStack();
        progress.report({ increment: 100 });
      });
    } catch (error) {
      console.error('Error syncing ZenML views:', error);
      showErrorMessage('Failed to sync ZenML views. See console for details.');
    }
  }



  /**
   * Retrieves or creates an instance of the ZenMLStatusBar.
   * This method implements the Singleton pattern to ensure that only one instance of ZenMLStatusBar exists.
   *
   * @returns {ZenMLStatusBar} The singleton instance of the ZenMLStatusBar.
   */
  public static getInstance(): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar();
    }
    return ZenMLStatusBar.instance;
  }

  /**
   * Asynchronously refreshes the active stack display in the status bar.
   * Attempts to retrieve the current active stack name and updates the status bar item accordingly.
   * Displays an error message in the status bar if unable to fetch the active stack.
   */
  public async refreshActiveStack(): Promise<void> {
    try {
      const activeStack = await getActiveStack();
      this.activeStack = activeStack?.name || 'default';
      this.activeStackItem.text = `${this.activeStack}`;
      this.activeStackItem.tooltip = 'Active ZenML stack.';
      this.activeStackItem.show();
    } catch (error) {
      console.error('Failed to fetch active ZenML stack:', error);
      this.activeStack = 'Error';
    }
  }

  /**
   * Updates the server status indicator in the status bar.
   * Sets the text, color, and tooltip of the server status item based on the connection status.
   *
   * @param {boolean} isConnected Whether the server is currently connected.
   * @param {string} serverAddress The address of the server, used in the tooltip.
   */
  public updateServerStatusIndicator(isConnected: boolean, serverAddress: string) {
    this.serverStatusItem.text = isConnected ? `$(vm-active)` : `$(vm-connect)`;
    this.serverStatusItem.color = isConnected ? 'green' : '';
    this.serverStatusItem.tooltip = isConnected
      ? `Server running at ${serverAddress}.`
      : 'Server not running. Click to refresh status.';
    this.serverStatusItem.show();
  }
}
