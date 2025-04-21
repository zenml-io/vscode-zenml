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
import { getStackById } from '../../../commands/stack/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { Stack, StackComponent, StacksResponse } from '../../../types/StackTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { CONTEXT_VALUES, TREE_ICONS } from '../../../utils/ui-constants';
import ZenMLStatusBar from '../../statusBar';
import {
  ErrorTreeItem,
  createAuthErrorItem,
  createErrorItem,
  createServicesNotAvailableItem,
} from '../common/ErrorTreeItem';
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
  private activeStackItem: StackTreeItem | undefined;
  private lsClientReady = false;

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
      this.activeStackId = '';
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
      this.lsClientReady = false;
      this.items = [createServicesNotAvailableItem()];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.lsClientReady = true;
      this.activeStackId = '';
      this.activeStackItem = undefined;
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
      const newStacksData = await this.fetchStacksWithComponents(
        page,
        itemsPerPage,
        this.activeStackId
      );
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
    itemsPerPage: number = 20,
    activeStackId: string = ''
  ): Promise<TreeItem[]> {
    if (!this.lsClientReady || !this.zenmlClientReady) {
      return [createServicesNotAvailableItem()];
    }

    // If activeStackId is from settings but doesn't match what's in zenml,
    // we want to let the server try to reconcile rather than failing early
    const args = [page, itemsPerPage, activeStackId ? activeStackId : null];

    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<StacksResponse>('fetchStacks', args);

      if (Array.isArray(result) && result.length === 1 && 'error' in result[0]) {
        const errorMessage = result[0].error;
        if (
          errorMessage.includes('Authentication error') ||
          errorMessage.includes('Not authorized')
        ) {
          return createAuthErrorItem(errorMessage);
        }
        return createErrorItem({
          errorType: 'Error',
          message: errorMessage,
        });
      }

      if (!result || 'error' in result) {
        console.error(`Failed to fetch stacks:`, result);

        // If we failed because of a missing stack ID, try one more time without the active stack ID
        if (activeStackId && result?.error?.includes('No stack with this ID found')) {
          console.log('Stack ID not found, retrying without active stack ID...');
          // Reset the active stack ID to trigger a clean fetch
          this.activeStackId = '';
          await this.refresh();
          return this.items;
        }

        if ('clientVersion' in result && 'serverVersion' in result) {
          return createErrorItem(result);
        } else if (result.error?.includes('Not authorized')) {
          return createErrorItem({
            errorType: 'AuthorizationException',
            message: result.error,
          });
        } else {
          return createErrorItem({
            errorType: 'Error',
            message: result.error,
          });
        }
      }

      if ('stacks' in result) {
        const { active_stack, stacks, total, total_pages, current_page, items_per_page } = result;
        this.pagination = {
          currentPage: current_page,
          itemsPerPage: items_per_page,
          totalItems: total,
          totalPages: total_pages,
        };

        if (stacks.length === 0 && !active_stack) {
          return this.createNoStacksFoundItem();
        }

        if (active_stack) {
          this.activeStackItem = this.convertToStackTreeItem(active_stack, true);
          this.updateStatusBar(active_stack);
          this.activeStackId = active_stack.id;
        }

        // The backend has already filtered out the active stack from stacks.
        let stackTreeItems: StackTreeItem[] = [];

        if (this.activeStackItem && stacks.length >= 1) {
          stackTreeItems = stacks.map(stack => this.convertToStackTreeItem(stack, false));
          stackTreeItems.unshift(this.activeStackItem);
        } else if (this.activeStackItem) {
          stackTreeItems = [this.activeStackItem];
        } else if (stacks.length > 0) {
          // If we don't have an active stack but have stacks, show them all as inactive
          stackTreeItems = stacks.map(stack => this.convertToStackTreeItem(stack, false));
        }

        return stackTreeItems;
      } else {
        console.error(`Unexpected response format:`, result);
        return [];
      }
    } catch (error: any) {
      console.error(`Failed to fetch stacks: ${error}`);

      // If the active stack ID is the issue, clear it and retry
      if (activeStackId && error.toString().includes('No stack with this ID found')) {
        console.log('Invalid active stack ID, retrying without it...');
        this.activeStackId = '';
        await this.refresh();
        return this.items;
      }

      return [
        new ErrorTreeItem('Error', `Failed to fetch stacks: ${error.message || error.toString()}`),
      ];
    }
  }

  /**
   * Updates the active stack item in the tree view.
   *
   * @param {string} activeStackId The ID of the newly active stack.
   * @returns {Promise<StackTreeItem | undefined>} A promise that resolves with the updated stack item or undefined if the stack details cannot be fetched.
   */
  private async updateActiveStackItem(activeStackId: string): Promise<StackTreeItem | undefined> {
    const activeStackDetails = await getStackById(activeStackId);
    if (activeStackDetails && !('error' in activeStackDetails)) {
      console.log('activeStackDetails', activeStackDetails);
      const activeStackItem = this.convertToStackTreeItem(activeStackDetails, true);
      this.updateStatusBar(activeStackDetails);
      return activeStackItem;
    } else {
      console.error(`Failed to fetch active stack details: ${JSON.stringify(activeStackDetails)}`);
    }
  }

  /**
   * Updates the active status of a stack item in the tree view.
   *
   * @param {StackTreeItem} stackItem The stack item to update.
   * @param {boolean} isActive Whether the stack item is active.
   */
  private setActive(stackItem: StackTreeItem, isActive: boolean): void {
    stackItem.isActive = isActive;
    stackItem.iconPath = isActive ? TREE_ICONS.ACTIVE_STACK : TREE_ICONS.STACK;
    stackItem.contextValue = isActive ? CONTEXT_VALUES.ACTIVE_STACK : CONTEXT_VALUES.STACK;
    stackItem.description = isActive ? 'Active' : '';

    // Regenerate component items with the correct active state
    if (stackItem.children) {
      const components = stackItem.getOriginalComponents();
      stackItem.children = stackItem.groupComponentsByType(components, isActive);
    }

    this._onDidChangeTreeData.fire(stackItem);
  }

  /**
   * Updates the active stack status in the tree view without refetching all stacks.
   *
   * @param {string} activeStackId The ID of the newly active stack.
   */
  public async updateActiveStack(activeStackId: string): Promise<void> {
    if (!this.items || this.items.length === 0 || !(this.items[0] instanceof StackTreeItem)) {
      return;
    }

    const newInactiveStackItems = this.items.filter(
      item => item instanceof StackTreeItem && item.id !== activeStackId
    ) as StackTreeItem[];

    this.items = newInactiveStackItems;

    // update the previous active stack item
    const prevActiveStackId = this.activeStackId;
    const prevActiveStackItem = newInactiveStackItems.find(item => item.id === prevActiveStackId);
    if (prevActiveStackItem) {
      this.setActive(prevActiveStackItem, false);
    }

    // update the active stack id and item
    this.activeStackId = activeStackId;
    try {
      const activeStackItem = await this.updateActiveStackItem(activeStackId);
      if (activeStackItem) {
        this.activeStackItem = activeStackItem;
        this.setActive(activeStackItem, true);
        this.items = [activeStackItem, ...newInactiveStackItems];
        this._onDidChangeTreeData.fire(undefined);
      }
    } catch (error) {
      console.error(`Failed to fetch active stack details: ${error}`);
    }
  }

  /**
   * Creates a TreeItem message when no stacks are found.
   *
   * @returns {TreeItem[]} An array with a single TreeItem showing a "No stacks found" message
   */
  private createNoStacksFoundItem(): TreeItem[] {
    const noStacksItem = new TreeItem(
      `No stacks found${this.activeProjectName ? ` for project '${this.activeProjectName}'` : ''}`
    );
    noStacksItem.contextValue = 'noStacks';
    noStacksItem.iconPath = new vscode.ThemeIcon('info');
    noStacksItem.tooltip = 'Create a stack to see it listed here';
    return [noStacksItem];
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
