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
import { StatusBarAlignment, StatusBarItem, ThemeColor, window } from 'vscode';
import { getActiveStack } from '../../commands/stack/utils';
import { EventBus } from '../../services/EventBus';
import { LSP_ZENML_STACK_CHANGED, SERVER_STATUS_UPDATED } from '../../utils/constants';

/**
 * Represents the ZenML extension's status bar.
 * This class manages two main status indicators: the server status and the active stack name.
 */
export default class ZenMLStatusBar {
  private static instance: ZenMLStatusBar;
  private statusBarItem: StatusBarItem;
  private currentStatus = { isConnected: false, serverUrl: '' }
  private activeStack: string = 'Loading...';
  private eventBus = EventBus.getInstance();

  /**
   * Initializes a new instance of the ZenMLStatusBar class.
   * Sets up the status bar items for server status and active stack, subscribes to server status updates,
   * and initiates the initial refresh of the status bar state.
   */
  constructor() {
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.subscribeToEvents();
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the status bar.
   *
   * @returns void
   */
  private subscribeToEvents(): void {
    this.eventBus.on(LSP_ZENML_STACK_CHANGED, async () => {
      await this.refreshActiveStack();
    });

    this.eventBus.on(SERVER_STATUS_UPDATED, ({ isConnected, serverUrl }) => {
      this.updateStatusBarItem(isConnected, serverUrl);
      this.currentStatus = { isConnected, serverUrl };
    });
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
   */
  public async refreshActiveStack(): Promise<void> {
    this.statusBarItem.text = `$(loading~spin) Loading...`;
    this.statusBarItem.show();

    try {
      const activeStack = await getActiveStack();
      this.activeStack = activeStack?.name || 'default';
    } catch (error) {
      console.error('Failed to fetch active ZenML stack:', error);
      this.activeStack = 'Error';
    }
    this.updateStatusBarItem(this.currentStatus.isConnected, this.currentStatus.serverUrl);
  }

  /**
    * Updates the status bar item with the server status and active stack information.
    *
    * @param {boolean} isConnected Whether the server is currently connected.
    * @param {string} serverUrl The url of the server, used in the tooltip.
    */
  private updateStatusBarItem(isConnected: boolean, serverUrl: string) {
    this.statusBarItem.text = `⛩ ${this.activeStack}`;
    this.statusBarItem.tooltip = isConnected
      ? `URL: ${serverUrl}. Active stack: ${this.activeStack}`
      : 'ZenML server not running. Click to refresh status.';
    this.statusBarItem.show();
  }
}