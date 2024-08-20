import { EventEmitter, TreeDataProvider, TreeItem, window } from 'vscode';
import { chatbotItem } from './chatbotItem';

export class ChatbotDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private inputText: string = '';

  constructor() {
    // Initialize the input box for user text input
    this.showInputBox();
  }

  showInputBox() {
    window.showInputBox({ prompt: 'Enter text here' }).then(value => {
      if (value) {
        this.inputText = value;
        this.refresh();
      }
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: chatbotItem): TreeItem {
    return element;
  }

  getChildren(element?: chatbotItem): Thenable<TreeItem[]> {
    if (!element) {
      // Root items with collapsible states
      return Promise.resolve([
        new chatbotItem('Collapsible Section 1', 'Description 1', true),
        new chatbotItem('Collapsible Section 2', 'Description 2', true),
        new chatbotItem(`User Input: ${this.inputText}`, '', false)
      ]);
    }
    return Promise.resolve([]);
  }
}
