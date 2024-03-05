// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
import * as vscode from 'vscode';
import { ServerStatus } from '../../../types/ServerTypes';

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
    this.description = `${this.serverStatus.isConnected ? 'Connected ✅' : 'Disconnected ❌'}`;

    if (serverStatus.isConnected) {
      this.children = [
        new ServerDetailTreeItem('URL', serverStatus.url),
        new ServerDetailTreeItem('ID', serverStatus.id),
        new ServerDetailTreeItem('Version', serverStatus.version),
        new ServerDetailTreeItem('Debug', serverStatus.debug.toString()),
        new ServerDetailTreeItem('Deployment Type', serverStatus.deployment_type),
        new ServerDetailTreeItem('Database Type', serverStatus.database_type),
        new ServerDetailTreeItem('Secrets Store Type', serverStatus.secrets_store_type),
        new ServerDetailTreeItem('Auth Scheme', serverStatus.auth_scheme),
      ];
    } else {
      this.children = undefined;
    }
  }
  contextValue = 'server';
}
