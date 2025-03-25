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
import { TreeItem } from 'vscode';
import { State } from 'vscode-languageclient';
import { getActiveProjectNameFromConfig } from '../../../commands/projects/utils';
import { getActiveStack } from '../../../commands/stack/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { Stack, StackComponent, StacksResponse } from '../../../types/StackTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { TREE_ICONS } from '../../../utils/ui-constants';
import ZenMLStatusBar from '../../statusBar';
import { ErrorTreeItem, createAuthErrorItem, createErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import { StackComponentTreeItem } from '../componentView/ComponentTreeItems';
import { StackTreeItem } from './StackTreeItems';

export class StackDataProvider extends PaginatedDataProvider {
  private static instance: StackDataProvider | null = null;
  private activeStackId: string = '';
  private activeProjectName: string | undefined;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;

  constructor() {
    super();
    this.subscribeToEvents();
    this.items = [LOADING_TREE_ITEMS.get('stacks')!];
    this.viewName = 'Stack';
  }

  /**
   * Retrieves the singleton instance of StackDataProvider.
   *
   * @returns {StackDataProvider} The singleton instance.
   */
  public static getInstance(): StackDataProvider {
    if (!StackDataProvider.instance) {
      StackDataProvider.instance = new StackDataProvider();
    }
    return StackDataProvider.instance;
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);

    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
  }

  /**
   * Handles the change in the project.
   *
   * @param {string} projectName The new project name.
   */
  private projectChangeHandler = (projectName?: string) => {
    console.log(`StackDataProvider received project change event: ${projectName}`);
    if (projectName && projectName !== this.activeProjectName) {
      this.activeProjectName = projectName;
      this.refresh();
    }
  };

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
    if (status !== State.Running) {
      this.triggerLoadingState('lsClient');
    } else {
      this.refresh();
    }
  };

  // update status bar when active stack changes
  private updateStatusBar = (activeStack: Stack) => {
    ZenMLStatusBar.getInstance().refreshActiveStack({
      id: activeStack.id,
      name: activeStack.name,
    });
  };

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isInitialized The new ZenML client state.
   */
  private zenmlClientStateChangeHandler = async (isInitialized: boolean) => {
    this.zenmlClientReady = isInitialized;
    if (!isInitialized) {
      this.triggerLoadingState('stacks');
    } else {
      if (!this.activeProjectName) {
        const projectName = getActiveProjectNameFromConfig();
        if (projectName) {
          this.activeProjectName = projectName;
        }
      }

      this.refresh();

      this.eventBus.off(LSP_ZENML_STACK_CHANGED, this.stackChangeHandler);
      this.eventBus.on(LSP_ZENML_STACK_CHANGED, this.stackChangeHandler);

      this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
      this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    }
  };

  /**
   * Handles the change in the active stack.
   *
   * @param {string} activeStackId The ID of the newly active stack.
   */
  private stackChangeHandler = async (activeStackId: string) => {
    await this.updateActiveStack(activeStackId);
  };

  /**
   * Refreshes the tree view data by refetching stacks and triggering the onDidChangeTreeData event.
   *
   * @returns {Promise<void>} A promise that resolves when the tree view data has been refreshed.
   */
  public async refresh(): Promise<void> {
    this.triggerLoadingState('stacks');

    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newStacksData = await this.fetchStacksWithComponents(page, itemsPerPage);
      this.items = newStacksData;
    } catch (error: any) {
      this.items = createErrorItem(error);
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

        return stacks.map((stack: Stack) => {
          const isActive = this.activeStackId === stack.id;
          const stackTreeItem = this.convertToStackTreeItem(stack, isActive);
          if (isActive) {
            ZenMLStatusBar.getInstance().refreshActiveStack({ id: stack.id, name: stack.name });
          }
          return stackTreeItem;
        });
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

  /**
   * Updates the active stack status in the tree view without refetching all stacks.
   * This is more efficient than a full refresh when only the active stack changes.
   *
   * @param {string} activeStackId The ID of the newly active stack.
   */
  public updateActiveStack(activeStackId: string): void {
    // Skip full refresh if there are no items yet
    this.activeStackId = activeStackId;
    if (!this.items || this.items.length === 0 || !(this.items[0] instanceof StackTreeItem)) {
      return;
    }

    this.items.forEach(item => {
      if (item instanceof StackTreeItem) {
        item.isActive = item.id === activeStackId;
        console.log('updateActiveStack', item.id, activeStackId, item.isActive);
        if (item.isActive) {
          ZenMLStatusBar.getInstance().refreshActiveStack({ id: item.id, name: item.name });
          item.iconPath = TREE_ICONS.ACTIVE_STACK;
          item.contextValue = 'activeStack';
        } else {
          item.iconPath = TREE_ICONS.STACK;
          item.contextValue = 'stack';
        }

        this._onDidChangeTreeData.fire(item);
      }
    });
  }

  /**
   * Transforms a stack from the API into a `StackTreeItem` with component sub-items.
   *
   * @param {any} stack - The stack object fetched from the API.
   * @returns {StackTreeItem} A `StackTreeItem` object representing the stack and its components.
   */
  private convertToStackTreeItem(stack: Stack, isActive: boolean): StackTreeItem {
    // the first arg to flatMap is the type of the component (skipped -- not needed here)
    const componentTreeItems = Object.entries(stack.components).flatMap(([, componentsArray]) =>
      componentsArray.map(
        (component: StackComponent) => new StackComponentTreeItem(component, stack.id)
      )
    );
    return new StackTreeItem(stack.name, stack.id, componentTreeItems, isActive);
  }
}
