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
  // Store pending active stack ID when event arrives during loading or when stack is outside current page
  private pendingActiveStackId?: string;

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
   * Creates an informational message tree item.
   *
   * @param {string} message The message to display
   * @returns {TreeItem} The tree item with the message
   */
  private createInitialMessage(message: string): TreeItem {
    const treeItem = new TreeItem(message);
    treeItem.iconPath = new vscode.ThemeIcon('info');
    treeItem.contextValue = 'stackMessage';
    return treeItem;
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    this.eventBus.off(LSP_ZENML_STACK_CHANGED, this.stackChangeHandler);

    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    // Subscribe to stack changes early to avoid missing events during initialization
    this.eventBus.on(LSP_ZENML_STACK_CHANGED, this.stackChangeHandler);
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
      // Clear pending state when client becomes uninitialized
      this.pendingActiveStackId = undefined;
      this.items = [
        this.createInitialMessage(
          'ZenML client not initialized. See Environment view for details.'
        ),
      ];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      if (!this.activeProjectName) {
        const projectName = getActiveProjectNameFromConfig();
        if (projectName) {
          this.activeProjectName = projectName;
        }
      }

      this.refresh();
      // Note: LSP_ZENML_STACK_CHANGED and LSP_ZENML_PROJECT_CHANGED subscriptions
      // are now in subscribeToEvents() to ensure we don't miss events during initialization
    }
  };

  /**
   * Handles the change in the active stack.
   *
   * @param {string} activeStackId The ID of the newly active stack.
   */
  private stackChangeHandler = async (activeStackId: string) => {
    // Check if we have actual StackTreeItems to update
    const hasStackItems = this.items?.some(item => item instanceof StackTreeItem);

    if (!hasStackItems) {
      // Store as pending - will be applied when items load in refresh()
      this.pendingActiveStackId = activeStackId;
      return;
    }

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

    // Use pending active stack ID if set (from events that arrived during loading or
    // when the active stack changed to one outside the current page)
    const requestedActiveStackId = this.pendingActiveStackId ?? this.activeStackId;

    try {
      const newStacksData = await this.fetchStacksWithComponents(
        page,
        itemsPerPage,
        requestedActiveStackId
      );
      this.items = newStacksData;

      // Clear pending state after successful refresh
      this.pendingActiveStackId = undefined;
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

        // Update status bar and active stack ID if we have an active stack
        if (active_stack) {
          this.updateStatusBar(active_stack);
          this.activeStackId = active_stack.id;
        }

        // Merge active stack back with other stacks and sort alphabetically by name.
        // The backend returns active_stack separately (filtered from stacks array),
        // so we need to combine them. Using alphabetical sort ensures:
        // 1. Consistent, predictable ordering across refreshes
        // 2. Active stack doesn't "jump" to top/bottom - it stays in its alphabetical position
        // 3. Matches the static ordering behavior of ProjectDataProvider
        const allStacks = [...stacks, ...(active_stack ? [active_stack] : [])].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

        const stackTreeItems = allStacks.map(stack =>
          this.convertToStackTreeItem(stack, stack.id === active_stack?.id)
        );

        // Update activeStackItem reference to point to the item in the list
        if (active_stack) {
          this.activeStackItem = stackTreeItems.find(item => item.id === active_stack.id);
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
   * Updates the active stack status in the tree view without refetching all stacks.
   * This now updates items in-place without reordering, matching ProjectDataProvider behavior.
   * If the active stack is not in the current page, triggers a full refresh to ensure the
   * active stack is visible (the backend always returns active_stack separately).
   *
   * @param {string} activeStackId The ID of the newly active stack.
   */
  public async updateActiveStack(activeStackId: string): Promise<void> {
    // Check if we have any StackTreeItems to update
    const hasStackItems = this.items?.some(item => item instanceof StackTreeItem);
    if (!hasStackItems) {
      this.pendingActiveStackId = activeStackId;
      return;
    }

    // Find the target stack in the current items
    const targetStack = this.items.find(
      item => item instanceof StackTreeItem && item.id === activeStackId
    ) as StackTreeItem | undefined;

    // Update provider state
    this.activeStackId = activeStackId;

    // If the target stack is not in the current page, trigger a full refresh.
    // The backend always returns active_stack separately, so refresh will ensure
    // the active stack is visible and marked correctly.
    if (!targetStack) {
      console.log(
        `[StackDataProvider] Active stack ${activeStackId} not in current page - triggering refresh`
      );
      this.pendingActiveStackId = activeStackId;
      await this.refresh();
      return;
    }

    // Toggle active state on all stack items in-place (no reordering)
    this.items.forEach(item => {
      if (item instanceof StackTreeItem) {
        const shouldBeActive = item.id === activeStackId;
        // Only update if the state actually changed
        if (item.isActive !== shouldBeActive) {
          item.setActive(shouldBeActive);
        }
      }
    });

    // Update status bar with the target stack info
    this.activeStackItem = targetStack;
    ZenMLStatusBar.getInstance().refreshActiveStack({
      id: targetStack.id,
      name: targetStack.name,
    });

    // Fire once for the entire tree (matches Project view's reliable pattern)
    this._onDidChangeTreeData.fire(undefined);
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
   * Displays a command error in the stack view.
   *
   * @param {TreeItem} errorItem The error item to display.
   */
  public showCommandError(errorItem: TreeItem): void {
    this.items = [errorItem];
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Displays a command success message in the stack view temporarily.
   *
   * @param {TreeItem} successItem The success item to display.
   */
  public showCommandSuccess(successItem: TreeItem): void {
    this.items = [successItem];
    this._onDidChangeTreeData.fire(undefined);

    // Clear the success message after 3 seconds and refresh
    setTimeout(() => {
      this.refresh();
    }, 3000);
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
