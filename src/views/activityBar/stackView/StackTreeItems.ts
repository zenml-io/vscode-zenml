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
import * as vscode from 'vscode';
import { CONTEXT_VALUES, TREE_ICONS } from '../../../utils/ui-constants';
import { TreeItemWithChildren } from '../common/TreeItemWithChildren';
import {
  ComponentCategoryTreeItem,
  StackComponentTreeItem,
} from '../componentView/ComponentTreeItems';

/**
 * A TreeItem for displaying a stack in the VSCode TreeView.
 * This item can be expanded to show the components of the stack.
 */
export class StackTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  public children?: vscode.TreeItem[];
  public isActive: boolean;
  public name: string;
  // Stores original components to update icon colors when active stack changes
  private originalComponents: StackComponentTreeItem[];

  constructor(
    public readonly label: string,
    public readonly id: string,
    components: StackComponentTreeItem[],
    isActive?: boolean
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = isActive ? CONTEXT_VALUES.ACTIVE_STACK : CONTEXT_VALUES.STACK;
    this.isActive = isActive || false;
    this.originalComponents = components;

    const groupedComponents = this.groupComponentsByType(components, this.isActive);
    this.children = groupedComponents;

    if (isActive) {
      this.iconPath = TREE_ICONS.ACTIVE_STACK;
      this.description = 'Active';
    } else {
      this.iconPath = TREE_ICONS.STACK;
      this.description = '';
    }

    this.name = label;

    this.tooltip = new vscode.MarkdownString(
      `**Stack: ${label}**\n\nID: ${id}\n\nActive: ${isActive ? 'Yes' : 'No'}`
    );
  }

  /**
   * Returns the original component items used to create this stack tree item
   */
  public getOriginalComponents(): StackComponentTreeItem[] {
    return this.originalComponents;
  }

  /**
   * Group components by their type and create component category items
   */
  public groupComponentsByType(
    components: StackComponentTreeItem[],
    isActive: boolean
  ): vscode.TreeItem[] {
    const groupedByType: { [key: string]: StackComponentTreeItem[] } = {};

    for (const component of components) {
      const type = component.component.type;
      if (!groupedByType[type]) {
        groupedByType[type] = [];
      }
      groupedByType[type].push(component);
    }

    return Object.entries(groupedByType).map(([type, items]) => {
      if (items.length === 1) {
        const component = items[0];

        const treeItem = new vscode.TreeItem(
          `${type}: ${component.component.name}`,
          vscode.TreeItemCollapsibleState.Collapsed
        ) as TreeItemWithChildren;

        treeItem.contextValue = isActive
          ? CONTEXT_VALUES.ACTIVE_STACK_COMPONENT
          : CONTEXT_VALUES.STACK_COMPONENT;
        treeItem.iconPath = isActive ? TREE_ICONS.ACTIVE_COMPONENT : TREE_ICONS.COMPONENT;
        treeItem.id = component.id;
        treeItem.tooltip = component.tooltip;
        treeItem.children = component.children;

        return treeItem;
      } else {
        // For multiple components (e.g., in the 'Stack Components' view), use a category
        return new ComponentCategoryTreeItem(type, items);
      }
    });
  }
}
