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
import { QuickPickItemKind, StatusBarAlignment, StatusBarItem, commands, window } from 'vscode';
import { getActiveStack, switchActiveStack } from '../../commands/stack/utils';
import { EventBus } from '../../services/EventBus';
import { LSP_ZENML_STACK_CHANGED, SERVER_STATUS_UPDATED } from '../../utils/constants';
import { StackDataProvider } from '../activityBar';

/**
 * Represents the ZenML extension's status bar.
 * This class manages two main status indicators: the server status and the active stack name.
 */
export default class ZenMLStatusBar {
  private static instance: ZenMLStatusBar;
  private statusBarItem: StatusBarItem;
  private serverStatus = { isConnected: false, serverUrl: '' };
  private activeStack: string = '$(loading~spin) Loading...';
  private activeStackId: string = '';
  private eventBus = EventBus.getInstance();

  /**
   * Initializes a new instance of the ZenMLStatusBar class.
   * Sets up the status bar items for server status and active stack, subscribes to server status updates,
   * and initiates the initial refresh of the status bar state.
   */
  constructor() {
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.subscribeToEvents();
    this.statusBarItem.command = 'zenml/statusBar/switchStack';
  }

  /**
   * Registers the commands associated with the ZenMLStatusBar.
   */
  public registerCommands(): void {
    commands.registerCommand('zenml/statusBar/switchStack', () => this.switchStack());
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
      this.updateStatusBarItem(isConnected);
      this.serverStatus = { isConnected, serverUrl };
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
      this.activeStackId = activeStack?.id || '';
      this.activeStack = activeStack?.name || 'default';
    } catch (error) {
      console.error('Failed to fetch active ZenML stack:', error);
      this.activeStack = 'Error';
    }
    this.updateStatusBarItem(this.serverStatus.isConnected);
  }

  /**
   * Updates the status bar item with the server status and active stack information.
   *
   * @param {boolean} isConnected Whether the server is currently connected.
   * @param {string} serverUrl The url of the server, used in the tooltip.
   */
  private updateStatusBarItem(isConnected: boolean) {
    this.statusBarItem.text = this.activeStack.includes('loading')
      ? this.activeStack
      : `⛩ ${this.activeStack}`;
    const serverStatusText = isConnected ? 'Connected ✅' : 'Disconnected';
    this.statusBarItem.tooltip = `Server Status: ${serverStatusText}\nActive Stack: ${this.activeStack}\n(click to switch stacks)`;
    this.statusBarItem.show();
  }

  /**
   * Switches the active stack by prompting the user to select a stack from the available options.
   *
   * @returns {Promise<void>} A promise that resolves when the active stack has been successfully switched.
   */
  private async switchStack(): Promise<void> {
    const stackDataProvider = StackDataProvider.getInstance();
    const stacks = await stackDataProvider.fetchStacksWithComponents();

    if (stacks.length === 0) {
      window.showErrorMessage('No stacks found.');
      return;
    }

    const activeStack = stacks.find(stack => stack.id === this.activeStackId);
    const otherStacks = stacks.filter(stack => stack.id !== this.activeStackId);

    const quickPickItems = [
      {
        label: 'Current Active',
        kind: QuickPickItemKind.Separator,
      },
      {
        label: activeStack?.label as string,
        id: activeStack?.id,
        kind: QuickPickItemKind.Default,
        disabled: true,
      },
      ...otherStacks.map(stack => ({
        id: stack.id,
        label: stack.label as string,
        kind: QuickPickItemKind.Default,
      })),
    ];

    // Temporarily disable the tooltip to prevent it from appearing after making a selection
    this.statusBarItem.tooltip = undefined;

    const selectedStack = await window.showQuickPick(quickPickItems, {
      placeHolder: 'Select a stack to switch to',
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: false,
    });

    if (selectedStack && selectedStack.id !== this.activeStackId) {
      this.statusBarItem.text = `$(loading~spin) Switching...`;
      this.statusBarItem.show();

      const stackId = otherStacks.find(stack => stack.label === selectedStack.label)?.id;
      if (stackId) {
        await switchActiveStack(stackId);
        await StackDataProvider.getInstance().refresh();
        this.activeStackId = stackId;
        this.activeStack = selectedStack.label;
        this.statusBarItem.text = `⛩ ${selectedStack.label}`;
      }
    }

    this.statusBarItem.hide();
    setTimeout(() => {
      const serverStatusText = this.serverStatus.isConnected
        ? 'Connected ✅'
        : 'Disconnected (local)';
      this.statusBarItem.tooltip = `Server Status: ${serverStatusText}\nActive Stack: ${this.activeStack}\n(click to switch stacks)`;
      this.statusBarItem.show();
    }, 0);
  }
}
