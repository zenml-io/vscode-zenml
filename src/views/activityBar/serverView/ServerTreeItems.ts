import * as vscode from "vscode";
import { ServerStatus } from "../../../types/ServerTypes";

/**
 * A specialized TreeItem for displaying details about a server's status.
 */
class ServerDetailTreeItem extends vscode.TreeItem {
  /**
  * Constructs a new ServerDetailTreeItem instance.
  * 
  * @param {string} label The detail label.
  * @param {string} detail The detail value.
  */
  constructor(label: string, detail: string) {
    super(`${label}: ${detail}`, vscode.TreeItemCollapsibleState.None);
  }
}

/**
 * TreeItem for representing and visualizing server status in a tree view. Includes details such as connectivity,
 * host, and port as children items when connected, or storeType and storeUrl when disconnected.
 */
export class ServerTreeItem extends vscode.TreeItem {
  public children: vscode.TreeItem[] | ServerDetailTreeItem[] | undefined;

  /**
  * Constructs a new ServerTreeItem instance.
  * 
  * @param {string} label The label for the tree item.
  * @param {ServerStatus} serverStatus The current status of the server.
  */
  constructor(public readonly label: string, public readonly serverStatus: ServerStatus) {
    super(
      label,
      serverStatus.isConnected
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.description = `${this.serverStatus.isConnected ? "Connected ✅" : "Disconnected ❌"
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
