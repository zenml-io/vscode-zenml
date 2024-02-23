// /src/views/server/ServerTreeItems.ts
import * as vscode from "vscode";

export interface ServerStatus {
  isConnected: boolean;
  host?: string;
  port?: number;
  storeType?: string;
  storeUrl?: string;
}

class ServerDetailTreeItem extends vscode.TreeItem {
  constructor(label: string, detail: string) {
    super(`${label}: ${detail}`, vscode.TreeItemCollapsibleState.None);
  }
}

/**
 * Extended TreeItem for representing a server's status.
 */
export class ServerTreeItem extends vscode.TreeItem {
  public children: vscode.TreeItem[] | ServerDetailTreeItem[] | undefined;

  constructor(
    public readonly label: string,
    public readonly serverStatus: ServerStatus
  ) {
    super(
      label,
      serverStatus.isConnected
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.description = `${
      this.serverStatus.isConnected ? "Connected ✅" : "Disconnected ❌"
    }`;

    this.children = [];

    if (serverStatus.isConnected) {
      if (serverStatus.host) {
        this.children.push(new ServerDetailTreeItem("Host", serverStatus.host));
      }
      if (serverStatus.port) {
        this.children.push(
          new ServerDetailTreeItem("Port", serverStatus.port.toString())
        );
      }
    } else {
      if (serverStatus.storeType) {
        this.children.push(
          new ServerDetailTreeItem("Store Type", serverStatus.storeType)
        );
      }
      if (serverStatus.storeUrl) {
        this.children.push(
          new ServerDetailTreeItem("Store URL", serverStatus.storeUrl)
        );
      }
    }
  }
  contextValue = "server";
}
