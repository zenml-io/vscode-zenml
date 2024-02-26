import * as vscode from "vscode";
import { getActiveStack } from "../../commands/stack/utils";
import { Shell } from "../../utils/Shell";
import { ServerStatusService } from "../../services/ServerStatusService";

/**
 * Represents the ZenML extension's status bar.
 * This class manages two main status indicators: the server status and the active stack name.
 */
export default class ZenMLStatusBar {
  private shell: Shell;
  private static instance: ZenMLStatusBar;
  private serverStatusItem: vscode.StatusBarItem;
  private activeStackItem: vscode.StatusBarItem;
  private serverStatusService: ServerStatusService;
  private activeStack: string = "Loading...";

  /**
   * Initializes a new instance of the ZenMLStatusBar class.
   * Sets up the status bar items for server status and active stack, subscribes to server status updates,
   * and initiates the initial refresh of the status bar state.
   * 
   * @param {Shell} shell An instance of Shell used for command execution and interaction with the system shell.
   */
  constructor(shell: Shell) {
    this.shell = shell;
    this.serverStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.activeStackItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.serverStatusService = ServerStatusService.getInstance(this.shell);
    this.serverStatusService.subscribe((status) => {
      this.updateServerStatusIndicator(status.isConnected, `${status.host}:${status.port}`);
    });
    this.refreshStatusBarState();
  }

  /**
   * Retrieves or creates an instance of the ZenMLStatusBar.
   * This method implements the Singleton pattern to ensure that only one instance of ZenMLStatusBar exists.
   * 
   * @param {Shell} shell An instance of Shell required to instantiate the ZenMLStatusBar.
   * @returns {ZenMLStatusBar} The singleton instance of the ZenMLStatusBar.
   */
  public static getInstance(shell: Shell): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar(shell);
    }
    return ZenMLStatusBar.instance;
  }

  /**
   * Refreshes the status bar state by updating the active stack and setting up a periodic refresh every 30 seconds.
   */
  private refreshStatusBarState() {
    this.refreshActiveStack();
    setInterval(() => {
      this.refreshActiveStack();
    }, 30000);
  }

  /**
   * Asynchronously refreshes the active stack display in the status bar.
   * Attempts to retrieve the current active stack name and updates the status bar item accordingly.
   * Displays an error message in the status bar if unable to fetch the active stack.
   */
  public async refreshActiveStack() {
    try {
      const activeStackName = await getActiveStack(this.shell);
      this.activeStack = activeStackName;
      this.refreshActiveStackText();
    } catch (error) {
      console.error("Failed to fetch active ZenML stack:", error);
      this.activeStack = "Error";
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
    this.serverStatusItem.color = isConnected ? "green" : "";
    this.serverStatusItem.tooltip = isConnected ? `Server running at ${serverAddress}. Click to refresh status.` : "Server not running. Click to refresh status.";
    this.serverStatusItem.show();
  }

  /**
   * Refreshes the text display of the active stack status bar item.
   * Updates the text and tooltip of the active stack item to reflect the current active stack.
   */
  private refreshActiveStackText() {
    this.activeStackItem.text = `${this.activeStack}`;
    this.activeStackItem.tooltip = "Click to refresh the active ZenML stack";
    this.activeStackItem.show();
  }
}
