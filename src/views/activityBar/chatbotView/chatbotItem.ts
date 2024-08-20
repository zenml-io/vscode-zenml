import { TreeItem, TreeItemCollapsibleState } from 'vscode';

export class chatbotItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly isCollapsible: boolean
  ) {
    super(
      label,
      isCollapsible
        ? TreeItemCollapsibleState.Collapsed
        : TreeItemCollapsibleState.None
    );
    this.tooltip = `${this.label} - ${this.description}`;
  }
}
