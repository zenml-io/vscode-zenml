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
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { ErrorTreeItem, createErrorItem, createAuthErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { CommandTreeItem } from '../common/PaginationTreeItems';
import { ComponentsListResponse, StackComponent } from '../../../types/StackTypes';
import { StackComponentTreeItem } from '../stackView/StackTreeItems';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';

export class ComponentDataProvider extends PaginatedDataProvider {
  private static instance: ComponentDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;

  constructor() {
    super();
    this.subscribeToEvents();
    this.items = [LOADING_TREE_ITEMS.get('components')!];
    this.viewName = 'Component';
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.on(LSCLIENT_STATE_CHANGED, (newState: State) => {
      if (newState === State.Running) {
        this.refresh();
      } else {
        this.items = [LOADING_TREE_ITEMS.get('lsClient')!];
        this._onDidChangeTreeData.fire(undefined);
      }
    });

    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, (isInitialized: boolean) => {
      this.zenmlClientReady = isInitialized;

      if (!isInitialized) {
        this.items = [LOADING_TREE_ITEMS.get('components')!];
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

  public async refresh(): Promise<void> {
    this.items = [LOADING_TREE_ITEMS.get('components')!];
    this._onDidChangeTreeData.fire(undefined);

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
        return components;
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
