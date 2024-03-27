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
import { ServerStatus } from '../../../types/ServerInfoTypes';

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
    // make URL item clickable (if not local db path)
    if (detail.startsWith('http://') || detail.startsWith('https://')) {
      this.command = {
        title: "Open URL",
        command: "vscode.open",
        arguments: [vscode.Uri.parse(detail)],
      };
      this.tooltip = `Click to open ${detail}`;
    }
  }
}

/**
 * TreeItem for representing and visualizing server status in a tree view. Includes details such as connectivity,
 * host, and port as children items when connected, or storeType and storeUrl when disconnected.
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
        : vscode.TreeItemCollapsibleState.Expanded
    );

    this.description = `${this.serverStatus.isConnected ? 'Connected ✅' : 'Disconnected'}`;
    this.children = this.determineChildrenBasedOnStatus();
  }

  private determineChildrenBasedOnStatus(): ServerDetailTreeItem[] {
    const children: ServerDetailTreeItem[] = [
      new ServerDetailTreeItem('URL', this.serverStatus.url),
      new ServerDetailTreeItem('Version', this.serverStatus.version),
      new ServerDetailTreeItem('Store Type', this.serverStatus.store_type || 'N/A'),
      new ServerDetailTreeItem('Deployment Type', this.serverStatus.deployment_type),
      new ServerDetailTreeItem('Database Type', this.serverStatus.database_type),
      new ServerDetailTreeItem('Secrets Store Type', this.serverStatus.secrets_store_type),
    ];

    // Conditional children based on server status type
    if (this.serverStatus.id) {
      children.push(new ServerDetailTreeItem('ID', this.serverStatus.id));
    }
    if (this.serverStatus.username) {
      children.push(new ServerDetailTreeItem('Username', this.serverStatus.username));
    }
    if (this.serverStatus.debug !== undefined) {
      children.push(new ServerDetailTreeItem('Debug', this.serverStatus.debug ? 'true' : 'false'));
    }
    if (this.serverStatus.auth_scheme) {
      children.push(new ServerDetailTreeItem('Auth Scheme', this.serverStatus.auth_scheme));
    }
    // Specific to SQL Server Status
    if (this.serverStatus.database) {
      children.push(new ServerDetailTreeItem('Database', this.serverStatus.database));
    }
    if (this.serverStatus.backup_directory) {
      children.push(
        new ServerDetailTreeItem('Backup Directory', this.serverStatus.backup_directory)
      );
    }
    if (this.serverStatus.backup_strategy) {
      children.push(new ServerDetailTreeItem('Backup Strategy', this.serverStatus.backup_strategy));
    }

    return children;
  }

  contextValue = 'server';
}
