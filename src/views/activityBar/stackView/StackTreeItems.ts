// /src/views/stack/items.ts
import * as vscode from "vscode";

interface StackComponent {
  id: string;
  name: string;
  type: string;
  flavor: string;
}

export class StackTreeItem extends vscode.TreeItem {
  children: vscode.TreeItem[] | undefined;

  constructor(
    public readonly label: string,
    public readonly stackId: string,
    components: { [key: string]: StackComponent[] }
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.children = Object.entries(components).flatMap(([key, components]) =>
      components.map(
        (component: StackComponent) =>
          new StackComponentTreeItem(`${key}: ${component.name}`, component)
      )
    );
    this.tooltip = `${this.label} - Click for more details`;
    this.contextValue = "stack";
  }
}

export class StackComponentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private readonly component: StackComponent
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = `${this.component.type} (${this.component.flavor})`;
    this.tooltip = `Type: ${this.component.type}, Flavor: ${this.component.flavor}`;
  }
}
