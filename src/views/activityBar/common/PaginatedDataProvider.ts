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

/**
 * Provides a base class to other DataProviders that provides all functionality
 * for pagination in a tree view.
 */
export class PaginatedDataProvider implements TreeDataProvider<TreeItem> {
  protected _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData: Event<TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;
  protected pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
  } = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  };
  public items: TreeItem[] = [];
  protected viewName: string = '';

  /**
   * Loads the next page.
   */
  public async goToNextPage(): Promise<void> {
    try {
      if (this.pagination.currentPage < this.pagination.totalPages) {
        this.pagination.currentPage++;
        await this.refresh();
      }
    } catch (e) {
      console.error(`Failed to go the next page: ${e}`);
    }
  }

  /**
   * Loads the previous page
   */
  public async goToPreviousPage(): Promise<void> {
    try {
      if (this.pagination.currentPage > 1) {
        this.pagination.currentPage--;
        await this.refresh();
      }
    } catch (e) {
      console.error(`Failed to go the previous page: ${e}`);
    }
  }

  /**
   * Sets the item count per page
   */
  public async updateItemsPerPage(): Promise<void> {
    try {
      const selected = await window.showQuickPick(ITEMS_PER_PAGE_OPTIONS, {
        placeHolder: 'Choose the max number of items to display per page',
      });
      if (selected) {
        this.pagination.itemsPerPage = parseInt(selected, 10);
        this.pagination.currentPage = 1;
        await this.refresh();
      }
    } catch (e) {
      console.error(`Failed to update items per page: ${e}`);
    }
  }

  /**
   * Refreshes the view.
   */
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

  /**
   * Gets the children of the selected element. This will insert
   * PaginationTreeItems for navigation if there are other pages.
   * @param {TreeItem} element The selected element
   * @returns Children of the selected element
   */
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
    const NEXT_PAGE_LABEL = 'Next Page';
    const PREVIOUS_PAGE_LABEL = 'Previous Page';
    const NEXT_PAGE_COMMAND = `zenml.next${this.viewName}Page`;
    const PREVIOUS_PAGE_COMMAND = `zenml.previous${this.viewName}Page`;

    if (treeItems.length === 0 && this.pagination.currentPage === 1) {
      return treeItems;
    }

    if (this.pagination.currentPage < this.pagination.totalPages) {
      treeItems.push(
        new CommandTreeItem(NEXT_PAGE_LABEL, NEXT_PAGE_COMMAND, undefined, 'arrow-circle-right')
      );
    }

    if (this.pagination.currentPage > 1) {
      treeItems.unshift(
        new CommandTreeItem(
          PREVIOUS_PAGE_LABEL,
          PREVIOUS_PAGE_COMMAND,
          undefined,
          'arrow-circle-left'
        )
      );
    }
    return treeItems;
  }
}
