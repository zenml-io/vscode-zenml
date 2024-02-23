import * as vscode from "vscode";
import { getActiveStack } from "../../commands/stack/utils";
import { Shell } from "../../utils/Shell";
import { ServerStatusService } from "../../services/ServiceStatusService";

export default class ZenMLStatusBar {
  private shell: Shell;
  private static instance: ZenMLStatusBar;
  private serverStatusItem: vscode.StatusBarItem;
  private activeStackItem: vscode.StatusBarItem;
  private serverStatusService: ServerStatusService;

  private activeStack: string = "Loading...";

  constructor(shell: Shell) {
    this.shell = shell;
    this.serverStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.activeStackItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.serverStatusService = ServerStatusService.getInstance(this.shell);
    this.serverStatusService.subscribe((status) => {
      this.updateServerStatusIndicator(
        status.isConnected,
        `${status.host}:${status.port}`
      );
    });
    this.refreshStatusBarState();
  }

  public static getInstance(shell: Shell): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar(shell);
    }
    return ZenMLStatusBar.instance;
  }

  private refreshStatusBarState() {
    this.refreshActiveStack();
    setInterval(() => {
      this.refreshActiveStack();
    }, 30000);
  }

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

  private updateServerStatusIndicator(
    isConnected: boolean,
    serverAddress: string
  ) {
    this.serverStatusItem.text = isConnected ? `$(vm-active)` : `$(vm-connect)`;
    this.serverStatusItem.color = isConnected ? "green" : "";
    this.serverStatusItem.tooltip = isConnected
      ? `Server running at ${serverAddress}. Click to refresh status.`
      : "Server not running. Click to refresh status.";
    this.serverStatusItem.show();
  }

  private refreshActiveStackText() {
    this.activeStackItem.text = `${this.activeStack}`;
    this.activeStackItem.tooltip = "Click to refresh the active ZenML stack";
    this.activeStackItem.show();
  }
}
