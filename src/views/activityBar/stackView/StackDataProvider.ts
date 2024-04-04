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
import { Stack, StackComponent, StacksResponse } from '../../../types/StackTypes';
import {
  ITEMS_PER_PAGE_OPTIONS,
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { ErrorTreeItem, createErrorItem, createAuthErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { StackComponentTreeItem, StackTreeItem } from './StackTreeItems';
import { CommandTreeItem } from '../common/PaginationTreeItems';

export class StackDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData: Event<TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;

  private static instance: StackDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  public stacks: StackTreeItem[] | TreeItem[] = [LOADING_TREE_ITEMS.get('stacks')!];

  private pagination = {
    currentPage: 1,
    itemsPerPage: 20,
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
        this.stacks = [LOADING_TREE_ITEMS.get('lsClient')!];
        this._onDidChangeTreeData.fire(undefined);
      }
    });

    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, (isInitialized: boolean) => {
      this.zenmlClientReady = isInitialized;

      if (!isInitialized) {
        this.stacks = [LOADING_TREE_ITEMS.get('stacks')!];
        this._onDidChangeTreeData.fire(undefined);
        return;
      }
      this.refresh();
      this.eventBus.off(LSP_ZENML_STACK_CHANGED, () => this.refresh());
      this.eventBus.on(LSP_ZENML_STACK_CHANGED, () => this.refresh());
    });
  }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {StackDataProvider} The singleton instance.
   */
  public static getInstance(): StackDataProvider {
    if (!this.instance) {
      this.instance = new StackDataProvider();
    }
    return this.instance;
  }

  /**
   * Returns the provided tree item.
   *
   * @param {TreeItem} element The tree item to return.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  /**
   * Refreshes the tree view data by refetching stacks and triggering the onDidChangeTreeData event.
   *
   * @returns {Promise<void>} A promise that resolves when the tree view data has been refreshed.
   */
  public async refresh(): Promise<void> {
    this.stacks = [LOADING_TREE_ITEMS.get('stacks')!];
    this._onDidChangeTreeData.fire(undefined);

    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newStacksData = await this.fetchStacksWithComponents(page, itemsPerPage);
      this.stacks = newStacksData;
    } catch (error: any) {
      this.stacks = createErrorItem(error);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Retrieves detailed stack information, including components, from the server.
   *
   * @returns {Promise<StackTreeItem[]>} A promise that resolves with an array of `StackTreeItem` objects.
   */
  async fetchStacksWithComponents(
    page: number = 1,
    itemsPerPage: number = 20
  ): Promise<TreeItem[]> {
    if (!this.zenmlClientReady) {
      return [LOADING_TREE_ITEMS.get('zenmlClient')!];
    }

    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<StacksResponse>('fetchStacks', [
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
          console.error(`Failed to fetch stacks: ${result.error}`);
          return [];
        }
      }

      if ('stacks' in result) {
        const { stacks, total, total_pages, current_page, items_per_page } = result;

        this.pagination = {
          currentPage: current_page,
          itemsPerPage: items_per_page,
          totalItems: total,
          totalPages: total_pages,
        };

        return stacks.map((stack: Stack) =>
          this.convertToStackTreeItem(stack, this.isActiveStack(stack.id))
        );
      } else {
        console.error(`Unexpected response format:`, result);
        return [];
      }
    } catch (error: any) {
      console.error(`Failed to fetch stacks: ${error}`);
      return [
        new ErrorTreeItem('Error', `Failed to fetch stacks: ${error.message || error.toString()}`),
      ];
    }
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

  /**
   * Retrieves the children of a given tree item.
   *
   * @param {TreeItem} element The tree item whose children to retrieve.
   * @returns A promise resolving to an array of child tree items or undefined if there are no children.
   */
  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      if (Array.isArray(this.stacks) && this.stacks.length > 0) {
        return this.stacks;
      }

      const stacks = await this.fetchStacksWithComponents(
        this.pagination.currentPage,
        this.pagination.itemsPerPage
      );
      if (this.pagination.currentPage < this.pagination.totalPages) {
        stacks.push(
          new CommandTreeItem('Next Page', 'zenml.nextStackPage', undefined, 'arrow-circle-right')
        );
      }
      if (this.pagination.currentPage > 1) {
        stacks.unshift(
          new CommandTreeItem(
            'Previous Page',
            'zenml.previousStackPage',
            undefined,
            'arrow-circle-left'
          )
        );
      }
      return stacks;
    } else if (element instanceof StackTreeItem) {
      return element.children;
    }
    return undefined;
  }

  /**
   * Helper method to determine if a stack is the active stack.
   *
   * @param {string} stackId The ID of the stack.
   * @returns {boolean} True if the stack is active; otherwise, false.
   */
  private isActiveStack(stackId: string): boolean {
    const activeStackId = workspace.getConfiguration('zenml').get<string>('activeStackId');
    return stackId === activeStackId;
  }

  /**
   * Transforms a stack from the API into a `StackTreeItem` with component sub-items.
   *
   * @param {any} stack - The stack object fetched from the API.
   * @returns {StackTreeItem} A `StackTreeItem` object representing the stack and its components.
   */
  private convertToStackTreeItem(stack: Stack, isActive: boolean): StackTreeItem {
    const componentTreeItems = Object.entries(stack.components).flatMap(([type, componentsArray]) =>
      componentsArray.map(
        (component: StackComponent) => new StackComponentTreeItem(component, stack.id)
      )
    );
    return new StackTreeItem(stack.name, stack.id, componentTreeItems, isActive);
  }
}
