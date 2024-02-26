import * as vscode from "vscode";
import { StackComponent } from '../../../types/StackTypes';

/**
 * A TreeItem for displaying a stack in the VSCode TreeView.
 * This item can be expanded to show the components of the stack.
 */
export class StackTreeItem extends vscode.TreeItem {
  children: vscode.TreeItem[] | undefined;

  /**
   * Constructs a StackTreeItem instance.
   * 
   * @param {string} label The display label for the tree item.
   * @param {string} stackId The unique identifier for the stack.
   * @param {{ [key: string]: StackComponent[] }} components The components that belong to the stack, organized by type.
   */
  constructor(
    public readonly label: string,
    public readonly stackId: string,
    components: { [key: string]: StackComponent[] }
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.children = Object.entries(components).flatMap(([key, components]) =>
      components.map((component: StackComponent) =>
        new StackComponentTreeItem(`${key}: ${component.name}`, component)
      )
    );
    this.tooltip = `${this.label} - Click for more details`;
    this.contextValue = "stack";
  }
}

/**
 * A TreeItem specifically for displaying a stack component within the stack tree view.
 */
export class StackComponentTreeItem extends vscode.TreeItem {
  /**
   * Constructs a StackComponentTreeItem instance.
   * 
   * @param {string} label The display label for the tree item, typically the component name.
   * @param {StackComponent} component The stack component this tree item represents.
   */
  constructor(
    public readonly label: string,
    private readonly component: StackComponent
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = `${this.component.type} (${this.component.flavor})`;
    this.tooltip = `Type: ${this.component.type}, Flavor: ${this.component.flavor}`;
  }
}
