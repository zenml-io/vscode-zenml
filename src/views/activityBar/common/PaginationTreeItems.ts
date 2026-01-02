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
import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';

/**
 * A TreeItem for displaying pagination in the VSCode TreeView.
 */
export class CommandTreeItem extends TreeItem {
  constructor(
    public readonly label: string,
    commandId: string,
    commandArguments?: any[],
    icon?: string
  ) {
    super(label);
    this.command = {
      title: label,
      command: commandId,
      arguments: commandArguments,
    };
    if (icon) {
      this.iconPath = new ThemeIcon(icon);
    }
  }
}

export class SetItemsPerPageTreeItem extends TreeItem {
  constructor() {
    super('Set items per page', TreeItemCollapsibleState.None);
    this.tooltip = 'Click to set the number of items shown per page';
    this.command = {
      command: 'zenml.setStacksPerPage',
      title: 'Set Stack Items Per Page',
      arguments: [],
    };
  }
}
