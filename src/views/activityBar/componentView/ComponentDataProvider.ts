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
import * as vscode from 'vscode';
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { ComponentsListResponse, StackComponent } from '../../../types/StackTypes';
import { LSCLIENT_STATE_CHANGED, LSP_ZENML_CLIENT_INITIALIZED } from '../../../utils/constants';
import { ErrorTreeItem, createAuthErrorItem, createErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import {
  ComponentCategoryTreeItem,
  ComponentTreeItem,
  StackComponentTreeItem,
} from './ComponentTreeItems';

export class ComponentDataProvider extends PaginatedDataProvider {
  private static instance: ComponentDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;

  constructor() {
    super();
    this.subscribeToEvents();
    this.items = [this.createInitialMessage()];
    this.viewName = 'Component';
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);

    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
  }

  /**
   * Triggers the loading state for a given entity.
   *
   * @param {string} entity The entity to trigger the loading state for.
   */
  private triggerLoadingState = (entity: string) => {
    this.items = [LOADING_TREE_ITEMS.get(entity)!];
    this._onDidChangeTreeData.fire(undefined);
  };

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private lsClientStateChangeHandler = (status: State) => {
    if (status === State.Running) {
      this.items = [this.createInitialMessage()];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.items = [this.createInitialMessage('Language server not running')];
      this._onDidChangeTreeData.fire(undefined);
    }
  };

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isInitialized The new ZenML client state.
   */
  private zenmlClientStateChangeHandler = (isInitialized: boolean) => {
    this.zenmlClientReady = isInitialized;
    if (!isInitialized) {
      this.items = [this.createInitialMessage('ZenML client not initialized')];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      // just show a message that components can be loaded
      this.items = [this.createInitialMessage()];
      this._onDidChangeTreeData.fire(undefined);
    }
  };

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
   * Creates the initial message tree item that tells users to refresh
   *
   * @param {string} message - Optional custom message to display
   * @returns {vscode.TreeItem} The tree item with the message
   */
  private createInitialMessage(message?: string): vscode.TreeItem {
    const defaultMessage = 'Click the refresh button to load stack components';
    const treeItem = new vscode.TreeItem(message || defaultMessage);
    treeItem.iconPath = new vscode.ThemeIcon('info');
    treeItem.contextValue = 'componentMessage';
    return treeItem;
  }

  /**
   * Refreshes the view.
   *
   * @returns {Promise<void>} A promise that resolves when the view is refreshed.
   */
  public async refresh(): Promise<void> {
    this.triggerLoadingState('components');

    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newComponentsData = await this.fetchComponents(page, itemsPerPage);
      this.items = newComponentsData;
    } catch (e) {
      this.items = createErrorItem(e);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Displays a command error in the component view.
   *
   * @param {vscode.TreeItem} errorItem The error item to display.
   */
  public showCommandError(errorItem: vscode.TreeItem): void {
    this.items = [errorItem];
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Displays a command success message in the component view temporarily.
   *
   * @param {vscode.TreeItem} successItem The success item to display.
   */
  public showCommandSuccess(successItem: vscode.TreeItem): void {
    this.items = [successItem];
    this._onDidChangeTreeData.fire(undefined);

    // Clear the success message after 3 seconds and refresh
    setTimeout(() => {
      this.refresh();
    }, 3000);
  }

  /**
   * Fetches the components from the ZenML server.
   *
   * @param {number} page The page number to fetch.
   * @param {number} itemsPerPage The number of items per page to fetch.
   * @returns {Promise<vscode.TreeItem[]>} The components.
   */
  private async fetchComponents(
    page: number = 1,
    itemsPerPage: number = 10
  ): Promise<vscode.TreeItem[]> {
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
        return createErrorItem({
          errorType: errorMessage.includes('Not authorized') ? 'AuthorizationException' : 'Error',
          message: errorMessage,
        });
      }

      if (!result || 'error' in result) {
        if ('clientVersion' in result && 'serverVersion' in result) {
          return createErrorItem(result);
        }
        if (result.error.includes('Not authorized')) {
          return createErrorItem({
            errorType: 'AuthorizationException',
            message: result.error,
          });
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

        const componentsMap = new Map<string, ComponentTreeItem[]>();

        items.forEach((component: StackComponent) => {
          const componentItem = new StackComponentTreeItem(component);
          const type = component.type
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());

          if (!componentsMap.has(type)) {
            componentsMap.set(type, []);
          }

          componentsMap.get(type)!.push(componentItem);
        });

        const categoryItems: vscode.TreeItem[] = [];
        componentsMap.forEach((componentItems, type) => {
          componentItems.sort((a, b) => a.component.name.localeCompare(b.component.name));
          let pluralizedType = type;
          if (type.endsWith('y')) {
            pluralizedType = type.slice(0, -1) + 'ies';
          } else {
            pluralizedType = type + 's';
          }
          const displayName = `${pluralizedType} (${componentItems.length})`;
          categoryItems.push(new ComponentCategoryTreeItem(displayName, componentItems));
        });

        categoryItems.sort((a, b) => {
          if (a instanceof ComponentCategoryTreeItem && b instanceof ComponentCategoryTreeItem) {
            return a.type.localeCompare(b.type);
          }
          return 0;
        });

        return categoryItems;
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
}
