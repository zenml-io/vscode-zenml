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
// or implied. See the License for the specific language governing
// permissions and limitations under the License.
import { ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { ServerStatus } from '../../../types/ServerInfoTypes';

/**
 * A specialized TreeItem for displaying details about a server's status.
 */
class ServerDetailTreeItem extends TreeItem {
  /**
   * Constructs a new ServerDetailTreeItem instance.
   *
   * @param {string} label The detail label.
   * @param {string} detail The detail value.
   * @param {string} [iconName] The name of the icon to display.
   */
  constructor(label: string, detail: string, iconName?: string) {
    super(`${label}: ${detail}`, TreeItemCollapsibleState.None);
    if (iconName) {
      this.iconPath = new ThemeIcon(iconName);
    }

    if (detail.startsWith('http://') || detail.startsWith('https://')) {
      this.command = {
        title: 'Open URL',
        command: 'vscode.open',
        arguments: [Uri.parse(detail)],
      };
      this.iconPath = new ThemeIcon('link', new ThemeColor('textLink.foreground'));
      this.tooltip = `Click to open ${detail}`;
    }
  }
}

/**
 * TreeItem for representing and visualizing server status in a tree view. Includes details such as connectivity,
 * host, and port as children items when connected, or storeType and storeUrl when disconnected.
 */
export class ServerTreeItem extends TreeItem {
  public children: TreeItem[] | ServerDetailTreeItem[] | undefined;

  constructor(
    public readonly label: string,
    public readonly serverStatus: ServerStatus
  ) {
    super(
      label,
      serverStatus.isConnected
        ? TreeItemCollapsibleState.Expanded
        : TreeItemCollapsibleState.Expanded
    );

    this.description = `${this.serverStatus.isConnected ? 'Connected ✅' : 'Disconnected'}`;
    this.children = this.determineChildrenBasedOnStatus();
  }

  private determineChildrenBasedOnStatus(): ServerDetailTreeItem[] {
    const children: ServerDetailTreeItem[] = [
      new ServerDetailTreeItem('URL', this.serverStatus.url, 'link'),
      new ServerDetailTreeItem('Dashboard URL', this.serverStatus.dashboard_url, 'link'),
      new ServerDetailTreeItem('Version', this.serverStatus.version, 'versions'),
      new ServerDetailTreeItem('Store Type', this.serverStatus.store_type || 'N/A', 'database'),
      new ServerDetailTreeItem('Deployment Type', this.serverStatus.deployment_type, 'rocket'),
      new ServerDetailTreeItem('Database Type', this.serverStatus.database_type, 'database'),
      new ServerDetailTreeItem('Secrets Store Type', this.serverStatus.secrets_store_type, 'lock'),
    ];

    // Conditional children based on server status type
    if (this.serverStatus.id) {
      children.push(new ServerDetailTreeItem('ID', this.serverStatus.id, 'key'));
    }
    if (this.serverStatus.username) {
      children.push(new ServerDetailTreeItem('Username', this.serverStatus.username, 'account'));
    }
    if (this.serverStatus.debug !== undefined) {
      children.push(
        new ServerDetailTreeItem('Debug', this.serverStatus.debug ? 'true' : 'false', 'bug')
      );
    }
    if (this.serverStatus.auth_scheme) {
      children.push(
        new ServerDetailTreeItem('Auth Scheme', this.serverStatus.auth_scheme, 'shield')
      );
    }
    // Specific to SQL Server Status
    if (this.serverStatus.database) {
      children.push(new ServerDetailTreeItem('Database', this.serverStatus.database, 'database'));
    }
    if (this.serverStatus.backup_directory) {
      children.push(
        new ServerDetailTreeItem('Backup Directory', this.serverStatus.backup_directory, 'folder')
      );
    }
    if (this.serverStatus.backup_strategy) {
      children.push(
        new ServerDetailTreeItem('Backup Strategy', this.serverStatus.backup_strategy, 'shield')
      );
    }

    return children;
  }

  contextValue = 'server';
}
