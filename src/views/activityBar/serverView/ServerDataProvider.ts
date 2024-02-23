// /src/views/server/ServerDataProvider.ts
import * as vscode from "vscode";
import { Shell } from "../../../utils/Shell";
import { ServerStatus, ServerTreeItem } from "./ServerTreeItems";
import { ServerStatusService } from "../../../services/ServiceStatusService";

export class ServerDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private serverStatusService: ServerStatusService;
  private currentServerStatus: ServerStatus = { isConnected: false };

  constructor(private shell: Shell) {
    this.serverStatusService = ServerStatusService.getInstance(this.shell);
    this.serverStatusService.subscribe((status) => {
      this.currentServerStatus = status;
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null
  > = this._onDidChangeTreeData.event;

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
