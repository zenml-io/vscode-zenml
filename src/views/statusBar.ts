import * as vscode from 'vscode';
import { getActiveStack } from '../commands/stackCommands';
import { checkZenMLServerStatus } from '../commands/serverCommands';
import { Shell } from '../utils/shell';

export class ZenMLStatusBar {
  private shell: Shell;
  private static instance: ZenMLStatusBar;
  private serverStatusItem: vscode.StatusBarItem;
  private activeStackItem: vscode.StatusBarItem;

  private host: string = '';
  private port: number = 0;
  private activeStack: string = 'Loading...';

  constructor(shell: Shell) {
    this.shell = shell;
    this.serverStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.activeStackItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);

    this.refreshStatusBarState();
  }

  public static getInstance(shell: Shell): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar(shell);
    }
    return ZenMLStatusBar.instance;
  }


  private refreshStatusBarState() {
    this.checkServerStatus();
    this.updateActiveStack();
    setInterval(() => {
      this.checkServerStatus();
      this.updateActiveStack();
    }, 30000);
  }

  public async updateActiveStack() {
    try {
      const activeStackName = await getActiveStack(this.shell);
      this.activeStack = activeStackName;
      this.updateActiveStackText();
    } catch (error) {
      console.error('Failed to fetch active ZenML stack:', error);
      this.activeStack = 'Error';
    }
    this.updateActiveStackText();
  }

  public async checkServerStatus() {
    const { isConnected, host, port } = await checkZenMLServerStatus(this.shell);
    const serverAddress = isConnected ? `${host}:${port}` : 'Server not available';
    this.updateServerStatusIndicator(isConnected, serverAddress);
  }

  private updateServerStatusIndicator(isConnected: boolean, serverAddress: string) {
    this.serverStatusItem.text = isConnected ? `$(vm-active)` : `$(vm-connect)`;
    this.serverStatusItem.color = isConnected ? 'green' : '';
    this.serverStatusItem.tooltip = isConnected ? `Server running at ${serverAddress}. Click to refresh status.` : 'Server not running. Click to refresh status.';
    this.serverStatusItem.show();
  }

  private updateActiveStackText() {
    this.activeStackItem.text = `${this.activeStack}`;
    this.activeStackItem.tooltip = 'Click to refresh the active ZenML stack';
    this.activeStackItem.show();
  }
}
