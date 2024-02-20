import * as vscode from 'vscode';
import { getActiveStack } from '../commands/stackCommands';
import { parseActiveStackName } from '../utils/helpers';

export class ZenMLStatusBar {
  private static instance: ZenMLStatusBar;
  private statusBar: vscode.StatusBarItem;
  private constructor() {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBar.command = 'zenml.showActiveStack';
    this.updateStatusBar();
  }

  public static getInstance(): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar();
      // ZenMLStatusBar.instance.startAutoRefresh();
    }
    return ZenMLStatusBar.instance;
  }

  // public startAutoRefresh() {
  //   const interval = 30000;
  //   setInterval(() => {
  //     this.updateStatusBar();
  //   }, interval);
  // }

  public show() {
    this.statusBar.show();
  }

  public hide() {
    this.statusBar.hide();
  }

  public updateStatusBar() {
    console.log('Updating ZenML active stack...');

    getActiveStack().then((activeStackCliOutput) => {
      const activeStack = parseActiveStackName(activeStackCliOutput);
      this.statusBar.text = `Active Stack: ${activeStack}`;
      this.statusBar.tooltip = 'Click to refresh the active ZenML stack';
      this.show();
    }).catch((error) => {
      console.error('Failed to fetch active ZenML stack:', error);
      this.statusBar.text = `Active Stack: Error`;
      this.show();
    });
  }
}
