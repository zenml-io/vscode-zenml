import * as vscode from "vscode";
import { Shell } from "../../../utils/Shell";
import { ServerTreeItem } from "./ServerTreeItems";
import { ServerStatusService } from "../../../services/ServerStatusService";
import { ServerStatus } from "../../../types/ServerTypes";

/**
 * Provides data for the server status tree view in the Activity Bar.
 * This class implements the TreeDataProvider interface, enabling it to supply server status data to a TreeView.
 */
export class ServerDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private serverStatusService: ServerStatusService;
  private currentServerStatus: ServerStatus = { isConnected: false };

  /**
   * Constructs a new ServerDataProvider instance.
   * Initializes the server status service and subscribes to server status updates to refresh the tree view.
   * 
   * @param {Shell} shell An instance of Shell used for command execution.
   */
  constructor(private shell: Shell) {
    this.serverStatusService = ServerStatusService.getInstance(this.shell);
    this.serverStatusService.subscribe((status) => {
      this.currentServerStatus = status;
      this.refresh();
    });
  }

  /**
   * Triggers a refresh of the tree data by firing the onDidChangeTreeData event.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;

  /**
   * Retrieves the tree item for a given element, applying appropriate icons based on the server's connectivity status.
   * 
   * @param {vscode.TreeItem} element The tree item to be processed.
   * @returns {vscode.TreeItem} The processed tree item with updated icon if applicable.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    if (element instanceof ServerTreeItem) {
      if (element.serverStatus.isConnected) {
        element.iconPath = new vscode.ThemeIcon("vm-active");
      } else {
        element.iconPath = new vscode.ThemeIcon("vm-connect");
      }
    }
    return element;
  }

  /**
   * Asynchronously fetches the children for a given tree item.
   * 
   * @param {vscode.TreeItem} element The parent tree item. If undefined, fetches the server status.
   * @returns {Promise<vscode.TreeItem[] | undefined>} A promise that resolves to an array of child tree items or undefined if no children exist.
   */
  async getChildren(
    element?: vscode.TreeItem
  ): Promise<vscode.TreeItem[] | undefined> {
    if (element instanceof ServerTreeItem) {
      return element.children;
    } else if (!element) {
      return [new ServerTreeItem("Server Status", this.currentServerStatus)];
    }
  }
}
