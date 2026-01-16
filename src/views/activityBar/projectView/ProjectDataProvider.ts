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
import { ThemeIcon, TreeItem } from 'vscode';
import { State } from 'vscode-languageclient';
import { getActiveProjectNameFromConfig } from '../../../commands/projects/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { Project, ProjectsResponse } from '../../../types/ProjectTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
} from '../../../utils/constants';
import { TREE_ICONS } from '../../../utils/ui-constants';
import {
  ErrorTreeItem,
  createAuthErrorItem,
  createErrorItem,
  createServicesNotAvailableItem,
} from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import { ProjectTreeItem } from './ProjectTreeItems';

export class ProjectDataProvider extends PaginatedDataProvider {
  private static instance: ProjectDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  // Track active project in provider state for immediate UI updates
  // (config writes are async and can lag behind)
  private activeProjectName?: string;
  // Store pending active project name when event arrives during loading
  private pendingActiveProjectName?: string;

  constructor() {
    super();
    this.subscribeToEvents();
    this.items = [LOADING_TREE_ITEMS.get('projects')!];
    this.viewName = 'Project';
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
    // Subscribe to project changes early to avoid missing events during initialization
    this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
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
    if (status !== State.Running) {
      this.items = [createServicesNotAvailableItem()];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.refresh();
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
      this.items = [
        this.createInitialMessage(
          'ZenML client not initialized. See Environment view for details.'
        ),
      ];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.refresh();
      // Note: LSP_ZENML_PROJECT_CHANGED subscription is now in subscribeToEvents()
      // to ensure we don't miss events during initialization
    }
  };

  /**
   * Handles the change in the active project.
   * The identifier can be either a project name (from local calls) or project ID (from LSP server).
   *
   * @param {string} projectIdentifier The name or ID of the newly active project.
   */
  private projectChangeHandler = (projectIdentifier: string) => {
    // Check if we have actual ProjectTreeItems to update
    const hasProjectItems = this.items?.some(item => item instanceof ProjectTreeItem);

    if (!hasProjectItems) {
      // Store as pending - will be applied when items load in refresh()
      // Note: this could be a name or ID, updateActiveProject will resolve it later
      this.pendingActiveProjectName = projectIdentifier;
      return;
    }

    // updateActiveProject will resolve the identifier (name or ID) and update state
    this.updateActiveProject(projectIdentifier);
  };

  /**
   * Retrieves the singleton instance of ProjectDataProvider.
   *
   * @returns {ProjectDataProvider} The singleton instance.
   */
  public static getInstance(): ProjectDataProvider {
    if (!ProjectDataProvider.instance) {
      ProjectDataProvider.instance = new ProjectDataProvider();
    }
    return ProjectDataProvider.instance;
  }

  /**
   * Creates an informational message tree item.
   *
   * @param {string} message The message to display
   * @returns {TreeItem} The tree item with the message
   */
  private createInitialMessage(message: string): TreeItem {
    const treeItem = new TreeItem(message);
    treeItem.iconPath = new ThemeIcon('info');
    treeItem.contextValue = 'projectMessage';
    return treeItem;
  }

  /**
   * Refreshes the tree view data by refetching projects and triggering the onDidChangeTreeData event.
   *
   * @returns {Promise<void>} A promise that resolves when the tree view data has been refreshed.
   */
  public async refresh(): Promise<void> {
    this.triggerLoadingState('projects');

    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newProjectsData = await this.fetchProjects(page, itemsPerPage);
      this.items = newProjectsData;

      // Apply any pending active project that arrived while we were loading
      if (this.pendingActiveProjectName) {
        const pendingName = this.pendingActiveProjectName;
        this.pendingActiveProjectName = undefined;
        this.updateActiveProject(pendingName);
        return; // updateActiveProject already fires the tree change event
      }
    } catch (error: any) {
      this.items = createErrorItem(error);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Retrieves detailed project information from the server.
   *
   * @returns {Promise<TreeItem[]>} A promise that resolves with an array of `ProjectTreeItem` objects.
   */
  async fetchProjects(page: number = 1, itemsPerPage: number = 20): Promise<TreeItem[]> {
    if (!this.zenmlClientReady) {
      return [createServicesNotAvailableItem()];
    }

    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<ProjectsResponse>('listProjects', [
        page,
        itemsPerPage,
      ]);

      if (Array.isArray(result) && result.length === 1 && 'error' in result[0]) {
        const errorMessage = result[0].error;
        console.error(`Failed to fetch projects:`, errorMessage);

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
        console.error(`Failed to fetch projects:`, result);
        if ('clientVersion' in result && 'serverVersion' in result) {
          return createErrorItem(result);
        } else if (result.error.includes('Not authorized')) {
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

      if ('projects' in result) {
        const { projects, total, total_pages, current_page, items_per_page } = result;

        this.pagination = {
          currentPage: current_page,
          itemsPerPage: items_per_page,
          totalItems: total,
          totalPages: total_pages,
        };

        if (projects.length === 0) {
          const noProjectsItem = new TreeItem(
            'No projects found for this workspace. Register a project to see it listed here.'
          );
          noProjectsItem.contextValue = 'noProjects';
          noProjectsItem.iconPath = new ThemeIcon('info');
          return [noProjectsItem];
        }

        return projects.map(
          (project: Project) =>
            new ProjectTreeItem(
              project,
              project.name,
              this.isActiveProject(project.name, project.id)
            )
        );
      } else {
        console.error(`Unexpected response format:`, result);
        return [];
      }
    } catch (error: any) {
      console.error(`Failed to fetch projects: ${error}`);
      return [
        new ErrorTreeItem(
          'Error',
          `Failed to fetch projects: ${error.message || error.toString()}`
        ),
      ];
    }
  }

  /**
   * Overrides the default getChildren method to return the children for a given TreeItem.
   *
   * @param element The TreeItem to get children for
   * @returns Array of TreeItem children or undefined
   */
  public async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      // Root level - return the main project items
      return this.items;
    }

    // Return children for tree items that implement TreeItemWithChildren
    if (element instanceof ProjectTreeItem && element.children) {
      return element.children;
    }

    return undefined;
  }

  /**
   * Helper method to determine if a project is the active project.
   * Prioritizes provider state over config to handle async config writes.
   * Handles both name and ID since the LSP server sends IDs but local calls use names.
   *
   * @param {string} projectName The name of the project.
   * @param {string} projectId The ID of the project.
   * @returns {boolean} True if the project is active; otherwise, false.
   */
  private isActiveProject(projectName: string, projectId: string): boolean {
    // Priority: pending state > provider state > config
    // This ensures UI correctness even when config write is still in progress
    const configValue = getActiveProjectNameFromConfig();
    const activeIdentifier = this.pendingActiveProjectName ?? this.activeProjectName ?? configValue;

    // The stored identifier could be either a name or an ID, so check both
    return projectName === activeIdentifier || projectId === activeIdentifier;
  }

  /**
   * Updates the active project status in the tree view without refetching all projects.
   * This is more efficient than a full refresh when only the active project changes.
   * Uses the same pattern as StackDataProvider.updateActiveStack for reliability.
   *
   * @param {string} activeProjectName The name of the newly active project.
   */
  public updateActiveProject(activeProjectIdentifier: string): void {
    // Check if we have any ProjectTreeItems to update
    const hasProjectItems = this.items?.some(item => item instanceof ProjectTreeItem);
    if (!hasProjectItems) {
      return;
    }

    // Find the target project - could be identified by name OR id
    // (LSP server sends ID, local calls send name)
    const targetProject = this.items.find(
      item =>
        item instanceof ProjectTreeItem &&
        (item.project.name === activeProjectIdentifier ||
          item.project.id === activeProjectIdentifier)
    ) as ProjectTreeItem | undefined;

    if (!targetProject) {
      return;
    }

    // Use the project name for state (consistent key)
    const activeProjectName = targetProject.project.name;

    // Update provider state with the resolved name
    this.activeProjectName = activeProjectName;
    this.pendingActiveProjectName = undefined;

    // Update only the relevant items (old active and new active)
    this.items.forEach(item => {
      if (item instanceof ProjectTreeItem) {
        const shouldBeActive = item.project.name === activeProjectName;
        // Only update if the state actually changed
        if (item.isActive !== shouldBeActive) {
          item.setActive(shouldBeActive);
        }
      }
    });

    // Fire once for the entire tree (matches Stack view's reliable pattern)
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Shows a command error in the tree view.
   * @param errorItem The error tree item to display
   */
  public showCommandError(errorItem: ErrorTreeItem): void {
    this.items = [errorItem];
    this._onDidChangeTreeData.fire(undefined);

    setTimeout(() => {
      this.refresh();
    }, 5000);
  }

  /**
   * Shows a command success message in the tree view.
   * @param successItem The success tree item to display
   */
  public showCommandSuccess(successItem: ErrorTreeItem): void {
    this.items = [successItem];
    this._onDidChangeTreeData.fire(undefined);

    setTimeout(() => {
      this.refresh();
    }, 3000);
  }
}
