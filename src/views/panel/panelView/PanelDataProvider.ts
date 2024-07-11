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
import { EventEmitter, TreeDataProvider, TreeItem } from 'vscode';
import {
  JsonObject,
  PanelDetailTreeItem,
  PanelTreeItem,
  SourceCodeTreeItem,
} from './PanelTreeItem';

export class PanelDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private static instance: PanelDataProvider | null = null;
  private data: JsonObject | null = null;
  private dataType: string = '';

  static getInstance(): PanelDataProvider {
    if (!this.instance) {
      this.instance = new PanelDataProvider();
    }
    return this.instance;
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  setData(data: JsonObject, dataType = 'data'): void {
    this.data = data;
    this.dataType = dataType;
    this.refresh();
  }

  getTreeItem(element: TreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element?: TreeItem | undefined): TreeItem[] | undefined {
    if (!element && this.data) {
      return [new PanelTreeItem(this.dataType, this.data)];
    } else if (
      element instanceof PanelTreeItem ||
      element instanceof PanelDetailTreeItem ||
      element instanceof SourceCodeTreeItem
    ) {
      return element.children;
    }
    return undefined;
  }
}
