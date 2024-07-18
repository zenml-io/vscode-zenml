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
import { Event, EventEmitter, TreeDataProvider, TreeItem, window, workspace } from 'vscode';
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import {
  ITEMS_PER_PAGE_OPTIONS,
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { ErrorTreeItem, createErrorItem, createAuthErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { CommandTreeItem } from '../common/PaginationTreeItems';
import { ComponentsListResponse, StackComponent } from '../../../types/StackTypes';
import { StackComponentTreeItem } from '../stackView/StackTreeItems';

export class ComponentDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData: Event<TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;

  private static instance: ComponentDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  public components: TreeItem[] = [LOADING_TREE_ITEMS.get('components')!];

  private pagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  };

  constructor() {
    this.subscribeToEvents();
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.on(LSCLIENT_STATE_CHANGED, (newState: State) => {
      if (newState === State.Running) {
        this.refresh();
      } else {
        this.components = [LOADING_TREE_ITEMS.get('lsClient')!];
        this._onDidChangeTreeData.fire(undefined);
      }
    });

    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, (isInitialized: boolean) => {
      this.zenmlClientReady = isInitialized;

      if (!isInitialized) {
        this.components = [LOADING_TREE_ITEMS.get('stacks')!];
        this._onDidChangeTreeData.fire(undefined);
        return;
      }
      this.refresh();
      this.eventBus.off(LSP_ZENML_STACK_CHANGED, () => this.refresh());
      this.eventBus.on(LSP_ZENML_STACK_CHANGED, () => this.refresh());
    });
  }

  /**
   * Retrieves the singleton instance of ComponentDataProvider
   *
   * @returns {ComponentDataProvider} The signleton instance.
   */
  public static getInstance(): ComponentDataProvider {
    if (!ComponentDataProvider.instance) {
      ComponentDataProvider.instance = new ComponentDataProvider();
    }

    return ComponentDataProvider.instance;
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

  public async refresh(): Promise<void> {
    this.components = [LOADING_TREE_ITEMS.get('components')!];
    this._onDidChangeTreeData.fire(undefined);

    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newComponentsData = await this.fetchComponents(page, itemsPerPage);
      this.components = newComponentsData;
    } catch (e) {
      this.components = createErrorItem(e);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

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
      placeHolder: 'Choose the max number of stacks to display per page',
    });
    if (selected) {
      this.pagination.itemsPerPage = parseInt(selected, 10);
      this.pagination.currentPage = 1;
      await this.refresh();
    }
  }

  public async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      if (Array.isArray(this.components) && this.components.length > 0) {
        return this.components;
      }

      const components = await this.fetchComponents(
        this.pagination.currentPage,
        this.pagination.itemsPerPage
      );
      return components;
    }

    return undefined;
  }

  private async fetchComponents(page: number = 1, itemsPerPage: number = 10) {
    if (!this.zenmlClientReady) {
      return [LOADING_TREE_ITEMS.get('zenmlClient')!];
    }

    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<ComponentsListResponse>('listComponents', [
        page,
        itemsPerPage,
      ]);

      if (Array.isArray(result) && result.length === 1 && 'error' in result[0]) {
        const errorMessage = result[0].error;
        if (errorMessage.includes('Authentication error')) {
          return createAuthErrorItem(errorMessage);
        }
      }

      if (!result || 'error' in result) {
        if ('clientVersion' in result && 'serverVersion' in result) {
          return createErrorItem(result);
        } else {
          console.error(`Failed to fetch stack components: ${result.error}`);
          return [];
        }
      }

      if ('items' in result) {
        const { items, total, total_pages, index, max_size } = result;
        this.pagination = {
          currentPage: index,
          itemsPerPage: max_size,
          totalItems: total,
          totalPages: total_pages,
        };

        const components = items.map(
          (component: StackComponent) => new StackComponentTreeItem(component)
        );
        return this.addPaginationCommands(components);
      } else {
        console.error('Unexpected response format:', result);
        return [];
      }
    } catch (e: any) {
      console.error(`Failed to fetch components: ${e}`);
      return [
        new ErrorTreeItem('Error', `Failed to fetch components: ${e.message || e.toString()}`),
      ];
    }
  }

  private addPaginationCommands(treeItems: TreeItem[]): TreeItem[] {
    if (this.pagination.currentPage < this.pagination.totalPages) {
      treeItems.push(
        new CommandTreeItem('Next Page', 'zenml.nextComponentPage', undefined, 'arrow-circle-right')
      );
    }

    if (this.pagination.currentPage > 1) {
      treeItems.unshift(
        new CommandTreeItem(
          'Previous Page',
          'zenml.previousComponentPage',
          undefined,
          'arrow-circle-left'
        )
      );
    }
    return treeItems;
  }
}
