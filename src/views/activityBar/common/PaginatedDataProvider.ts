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

import { Event, EventEmitter, TreeDataProvider, TreeItem, window } from 'vscode';
import { ITEMS_PER_PAGE_OPTIONS } from '../../../utils/constants';
import { CommandTreeItem } from './PaginationTreeItems';
import { LoadingTreeItem } from './LoadingTreeItem';
import { ErrorTreeItem } from './ErrorTreeItem';

export class PaginatedDataProvider implements TreeDataProvider<TreeItem> {
  protected _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData: Event<TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;
  protected pagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  };
  public items: TreeItem[] = [];
  protected viewName: string = '';

  public async goToNextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages) {
      this.pagination.currentPage++;
      await this.refresh();
    }
  }

  public async goToPreviousPage() {
    if (this.pagination.currentPage > 1) {
      this.pagination.currentPage--;
      await this.refresh();
    }
  }

  public async updateItemsPerPage() {
    const selected = await window.showQuickPick(ITEMS_PER_PAGE_OPTIONS, {
      placeHolder: 'Choose the max number of items to display per page',
    });
    if (selected) {
      this.pagination.itemsPerPage = parseInt(selected, 10);
      this.pagination.currentPage = 1;
      await this.refresh();
    }
  }

  public async refresh(): Promise<void> {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Returns the provided tree item.
   *
   * @param element element The tree item to return.
   * @returns The corresponding VS Code tree item
   */
  public getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  public async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      if (this.items[0] instanceof LoadingTreeItem || this.items[0] instanceof ErrorTreeItem) {
        return this.items;
      }
      return this.addPaginationCommands(this.items.slice());
    }

    if ('children' in element && Array.isArray(element.children)) {
      return element.children;
    }

    return undefined;
  }

  private addPaginationCommands(treeItems: TreeItem[]): TreeItem[] {
    if (this.pagination.currentPage < this.pagination.totalPages) {
      treeItems.push(
        new CommandTreeItem(
          'Next Page',
          `zenml.next${this.viewName}Page`,
          undefined,
          'arrow-circle-right'
        )
      );
    }

    if (this.pagination.currentPage > 1) {
      treeItems.unshift(
        new CommandTreeItem(
          'Previous Page',
          `zenml.previous${this.viewName}Page`,
          undefined,
          'arrow-circle-left'
        )
      );
    }
    return treeItems;
  }
}
