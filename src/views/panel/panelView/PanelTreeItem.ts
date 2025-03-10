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

type JsonType = string | number | Array<JsonType> | JsonObject;

export interface JsonObject {
  [key: string]: JsonType;
}

export class PanelDetailTreeItem extends TreeItem {
  public children: PanelDetailTreeItem[] = [];

  /**
   * Constructs a PanelDetailTreeItem object
   * @param key Property key for TreeItem
   * @param value Property value for the TreeItem
   */
  constructor(key: string, value: JsonType) {
    const simpleValue = typeof value === 'string' || typeof value === 'number';
    super(key, simpleValue ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed);
    if (simpleValue) {
      this.description = String(value);
    } else if (value) {
      this.description = '...';
      this.children = Object.entries(value).map(
        ([key, value]) => new PanelDetailTreeItem(key, value)
      );
    }

    if (typeof value === 'string' && value.startsWith('http')) {
      this.command = {
        title: 'Open URL',
        command: 'vscode.open',
        arguments: [Uri.parse(value)],
      };
      this.iconPath = new ThemeIcon('link', new ThemeColor('textLink.foreground'));
      this.tooltip = `Click to open ${value}`;
    }
  }
}

export class PanelTreeItem extends TreeItem {
  public children: Array<PanelDetailTreeItem | SourceCodeTreeItem> = [];

  /**
   * Constructs a PanelTreeItem
   * @param label Data Type Label for the PanelTreeItem
   * @param data Object Data to build children
   */
  constructor(label: string, data: JsonObject) {
    super(label, TreeItemCollapsibleState.Expanded);
    this.children = Object.entries(data).map(([key, value]) => {
      if (key === 'sourceCode' && typeof value === 'string') {
        return new SourceCodeTreeItem(key, value);
      }
      return new PanelDetailTreeItem(key, value);
    });
  }
}

export class SourceCodeTreeItem extends TreeItem {
  public children: TreeItem[] = [];

  /**
   * Constructs a SourceCodeTreeItem that builds its childrens based on string passed to it
   * @param label Property Label for parent object
   * @param sourceCode Raw string of source code
   */
  constructor(label: string, sourceCode: string) {
    super(label, TreeItemCollapsibleState.Collapsed);
    this.description = '...';

    const lines = sourceCode.split('\n');
    this.children = lines.map(line => new TreeItem(line));
  }
}
