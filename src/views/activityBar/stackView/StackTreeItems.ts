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
import { StackComponent } from '../../../types/StackTypes';

/**
 * A TreeItem for displaying a stack in the VSCode TreeView.
 * This item can be expanded to show the components of the stack.
 */
export class StackTreeItem extends vscode.TreeItem {
  public children: vscode.TreeItem[] | undefined;
  public isActive: boolean;

  constructor(
    public readonly label: string,
    public readonly id: string,
    components: StackComponentTreeItem[],
    isActive?: boolean
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.children = components;
    this.contextValue = 'stack';
    this.isActive = isActive || false;

    if (isActive) {
      this.label = `${this.label} 🟢`;
    }

  }
}

/**
 * A TreeItem for displaying a stack component in the VSCode TreeView.
 */
export class StackComponentTreeItem extends vscode.TreeItem {
  public workspaceId: string;

  constructor(component: StackComponent, stackId: string) {
    super(component.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `Type: ${component.type}, Flavor: ${component.flavor}`;
    this.description = `${component.type} (${component.flavor})`;
    this.workspaceId = component.workspaceId;
    this.contextValue = 'stackComponent';
    this.id = `${stackId}-${component.id}`;
  }
}
