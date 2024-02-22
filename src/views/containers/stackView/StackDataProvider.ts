// /src/views/stack/stackDataProvider.ts
import * as vscode from 'vscode';
import { Shell } from '../../../utils/shell';
import { StackTreeItem } from './StackTreeItems';

export class StackDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private shell: Shell) { }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (element instanceof StackTreeItem) {
      return element.children;
    } else if (!element) {
      return this.fetchStacks();
    }
  }

  private async fetchStacks(): Promise<StackTreeItem[]> {
    const stdout = await this.shell.runPythonScript('fetch_stacks.py');
    const stacksData = JSON.parse(stdout);
    const stackItems = stacksData.map((stack: any) => new StackTreeItem(stack.name, stack.id, stack.components));
    return stackItems;
  }
}
