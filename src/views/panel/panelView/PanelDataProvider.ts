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

import { LoadingTreeItem } from '../../activityBar/common/LoadingTreeItem';

export class PanelDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private static instance: PanelDataProvider | null = null;
  private data: JsonObject | TreeItem = new TreeItem(
    'No data has been requested for visualization yet'
  );
  private dataType: string = '';

  /**
   * Retrieves the singleton instance of PanelDataProvider
   * @returns {PanelDataProvider} The singleton instance
   */
  public static getInstance(): PanelDataProvider {
    if (!PanelDataProvider.instance) {
      PanelDataProvider.instance = new PanelDataProvider();
    }

    return PanelDataProvider.instance;
  }

  /**
   * Refreshes the ZenML Panel View
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Sets the data to be viewed in the ZenML Panel View
   * @param data Data to visualize
   * @param dataType Type of data being visualized
   */
  public setData(data: JsonObject, dataType = 'data'): void {
    this.data = data;
    this.dataType = dataType;
    this.refresh();
  }

  public setLoading(): void {
    this.data = new LoadingTreeItem('Retrieving data');
    this.refresh();
  }

  /**
   * Retrieves the tree item for a given data property
   *
   * @param element The data property.
   * @returns The corresponding VS Code tree item.
   */
  public getTreeItem(element: TreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  /**
   * Retrieves the children for a given tree item.
   *
   * @param element The parent tree item. If undefined, a PanelTreeItem is created
   * @returns An array of child tree items or undefined if there are no children.
   */
  public getChildren(element?: TreeItem | undefined): TreeItem[] | undefined {
    if (element) {
      if (
        element instanceof PanelTreeItem ||
        element instanceof PanelDetailTreeItem ||
        element instanceof SourceCodeTreeItem
      ) {
        return element.children;
      }

      return undefined;
    }

    if (this.data instanceof TreeItem) {
      return [this.data];
    }

    return [new PanelTreeItem(this.dataType, this.data)];
  }
}
