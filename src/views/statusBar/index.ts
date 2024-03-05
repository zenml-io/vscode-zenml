import * as vscode from 'vscode';
import { getActiveStack } from '../../commands/stack/utils';
import { ServerStatusService } from '../../services/ServerStatusService';
import { ZenMLClient } from '../../services/ZenMLClient';

/**
 * Represents the ZenML extension's status bar.
 * This class manages two main status indicators: the server status and the active stack name.
 */
export default class ZenMLStatusBar {
  private static instance: ZenMLStatusBar;
  private context: vscode.ExtensionContext;
  private apiClient: ZenMLClient = ZenMLClient.getInstance();
  private serverStatusItem: vscode.StatusBarItem;
  private activeStackItem: vscode.StatusBarItem;
  private serverStatusService: ServerStatusService;
  private activeStack: string = 'Loading...';

  /**
   * Initializes a new instance of the ZenMLStatusBar class.
   * Sets up the status bar items for server status and active stack, subscribes to server status updates,
   * and initiates the initial refresh of the status bar state.
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.serverStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.activeStackItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.serverStatusService = ServerStatusService.getInstance();
    this.serverStatusService.subscribe(status => {
      this.updateServerStatusIndicator(status.isConnected, `${this.apiClient.getZenMLServerUrl()}`);
    });
    this.refreshActiveStack();
  }

  /**
   * Retrieves or creates an instance of the ZenMLStatusBar.
   * This method implements the Singleton pattern to ensure that only one instance of ZenMLStatusBar exists.
   *
   * @returns {ZenMLStatusBar} The singleton instance of the ZenMLStatusBar.
   */
  public static getInstance(context: vscode.ExtensionContext): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar(context);
    }
    return ZenMLStatusBar.instance;
  }

  /**
   * Asynchronously refreshes the active stack display in the status bar.
   * Attempts to retrieve the current active stack name and updates the status bar item accordingly.
   * Displays an error message in the status bar if unable to fetch the active stack.
   */
  public async refreshActiveStack() {
    try {
      const activeStack = await getActiveStack();
      this.activeStack = activeStack?.name || 'default';
      this.refreshActiveStackText();
    } catch (error) {
      console.error('Failed to fetch active ZenML stack:', error);
      this.activeStack = 'Error';
    }
    this.refreshActiveStackText();
  }

  /**
   * Updates the server status indicator in the status bar.
   * Sets the text, color, and tooltip of the server status item based on the connection status.
   *
   * @param {boolean} isConnected Whether the server is currently connected.
   * @param {string} serverAddress The address of the server, used in the tooltip.
   */
  private updateServerStatusIndicator(isConnected: boolean, serverAddress: string) {
    this.serverStatusItem.text = isConnected ? `$(vm-active)` : `$(vm-connect)`;
    this.serverStatusItem.color = isConnected ? 'green' : '';
    this.serverStatusItem.tooltip = isConnected
      ? `Server running at ${serverAddress}.`
      : 'Server not running. Click to refresh status.';
    this.serverStatusItem.show();
  }

  /**
   * Refreshes the text display of the active stack status bar item.
   * Updates the text and tooltip of the active stack item to reflect the current active stack.
   */
  private refreshActiveStackText() {
    this.activeStackItem.text = `${this.activeStack}`;
    this.activeStackItem.tooltip = 'Active ZenML stack.';
    this.activeStackItem.show();
  }
}
