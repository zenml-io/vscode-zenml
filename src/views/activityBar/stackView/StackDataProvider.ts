import * as vscode from "vscode";
import { Shell } from "../../../utils/Shell";
import { StackTreeItem } from "./StackTreeItems";

/**
 * Provides data for the stack tree view in the Activity Bar.
 * This class implements the TreeDataProvider interface from vscode, allowing it to supply stack-related data to a TreeView.
 */
export class StackDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  /**
   * Constructs a StackDataProvider instance.
   * 
   * @param {Shell} shell An instance of Shell used to run shell commands, specifically for fetching stack information.
   */
  constructor(private shell: Shell) { }

  /**
   * Triggers a refresh of the tree data by firing the onDidChangeTreeData event.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;

  /**
   * Retrieves the tree item for a given element.
   * 
   * @param {vscode.TreeItem} element The tree item to be returned.
   * @returns {vscode.TreeItem} The tree item itself.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Asynchronously retrieves the children of a given tree item.
   * If no element is provided, it fetches the root stacks.
   * 
   * @param {vscode.TreeItem} element The parent tree item.
   * @returns {Promise<vscode.TreeItem[] | undefined>} A promise that resolves to an array of child tree items.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (element instanceof StackTreeItem) {
      return element.children;
    } else if (!element) {
      return this.fetchStacks();
    }
  }

  /**
   * Fetches stack information by executing a Python script and transforms the output into StackTreeItems.
   * 
   * @returns {Promise<StackTreeItem[]>} A promise that resolves to an array of StackTreeItems representing the fetched stacks.
   */
  private async fetchStacks(): Promise<StackTreeItem[]> {
    const stdout = await this.shell.runPythonScript("fetch_stacks.py");
    const stacksData = JSON.parse(stdout);
    return stacksData.map((stack: any) => new StackTreeItem(stack.name, stack.id, stack.components));
  }
}
