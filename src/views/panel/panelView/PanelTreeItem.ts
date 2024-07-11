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
import { TreeItem, TreeItemCollapsibleState } from 'vscode';

type JsonType = string | number | Array<JsonType> | JsonObject;

export interface JsonObject {
  [key: string]: JsonType;
}

export class PanelDetailTreeItem extends TreeItem {
  public children: PanelDetailTreeItem[] = [];

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
  }
}

export class PanelTreeItem extends TreeItem {
  public children: Array<PanelDetailTreeItem | SourceCodeTreeItem> = [];

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

  constructor(label: string, sourceCode: string) {
    super(label, TreeItemCollapsibleState.Collapsed);
    this.description = '...';

    const lines = sourceCode.split('\n');
    this.children = lines.map(line => new TreeItem(line));
  }
}
