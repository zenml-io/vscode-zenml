import * as vscode from 'vscode';
import { Flavor, StackComponent } from '../../../types/StackTypes';
import { formatFlavorTooltip } from '../../../utils/componentUtils';
import { CONTEXT_VALUES, TREE_ICONS } from '../../../utils/ui-constants';
import { TreeItemWithChildren } from '../common/TreeItemWithChildren';

/**
 * TreeItem for grouping components by type
 */
export class ComponentCategoryTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  public children?: vscode.TreeItem[];

  constructor(
    public readonly type: string,
    public readonly childComponents: ComponentTreeItem[]
  ) {
    super(type, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = CONTEXT_VALUES.COMPONENT_CATEGORY;
    this.iconPath = TREE_ICONS.COMPONENT_CATEGORY;
    this.tooltip = `Component Type: ${type}`;
    this.children = childComponents;
  }
}

/**
 * Formats a component detail attribute for display
 */
export class ComponentDetailTreeItem extends vscode.TreeItem {
  constructor(label: string, value: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.contextValue = CONTEXT_VALUES.COMPONENT_DETAIL;
    this.tooltip = '';
  }
}

/**
 * A TreeItem for displaying a component in the VSCode TreeView.
 */
export class ComponentTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  public children?: vscode.TreeItem[];

  constructor(
    public component: StackComponent,
    public parentId?: string
  ) {
    super(component.name, vscode.TreeItemCollapsibleState.Collapsed);

    const flavorTooltip = component.flavor
      ? formatFlavorTooltip(component.flavor)
      : component.flavor || '';

    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**Component: ${component.name}**\n\n`);
    this.tooltip.appendMarkdown(`**Type:** ${component.type}\n\n`);
    this.tooltip.appendMarkdown(`**Flavor:**  \n${flavorTooltip}\n\n`);
    this.tooltip.appendMarkdown(`**ID:** ${component.id}`);
    if (parentId) {
      this.tooltip.appendMarkdown(`\n\n**Stack ID:** ${parentId}`);
    }

    this.contextValue = CONTEXT_VALUES.COMPONENT;
    this.id = parentId ? `${parentId}-${component.id}` : `${component.id}`;
    this.iconPath = TREE_ICONS.COMPONENT;

    this.children = this.createDetailItems(parentId);
  }

  /**
   * Creates detail items for the component's attributes
   */
  protected createDetailItems(parentId?: string): vscode.TreeItem[] {
    const details: vscode.TreeItem[] = [];

    details.push(new ComponentDetailTreeItem('name', this.component.name));
    details.push(new ComponentDetailTreeItem('type', this.component.type));
    const flavor = this.component.flavor as Flavor | string;
    if (flavor) {
      if (typeof flavor === 'string') {
        details.push(new ComponentDetailTreeItem('flavor', flavor));
      } else {
        if (flavor.name) {
          details.push(new ComponentDetailTreeItem('flavor', flavor.name));
        }
        if (flavor.integration) {
          details.push(new ComponentDetailTreeItem('integration', flavor.integration));
        }
      }
    }

    details.push(new ComponentDetailTreeItem('id', this.component.id));

    if (parentId) {
      details.push(new ComponentDetailTreeItem('stack_id', parentId));
    }

    return details;
  }
}

/**
 * Specialized ComponentTreeItem for stack components
 */
export class StackComponentTreeItem extends ComponentTreeItem {
  constructor(
    public component: StackComponent,
    public stackId?: string
  ) {
    super(component, stackId);
    this.contextValue = CONTEXT_VALUES.STACK_COMPONENT;
  }
}
