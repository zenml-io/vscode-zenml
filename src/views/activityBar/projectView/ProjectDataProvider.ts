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
import { ThemeColor, ThemeIcon, TreeItem } from 'vscode';
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
import { ErrorTreeItem, createAuthErrorItem, createErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import { ProjectTreeItem } from './ProjectTreeItems';

export class ProjectDataProvider extends PaginatedDataProvider {
  private static instance: ProjectDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;

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
   * Handles the change in the project.
   *
   * @param {string} projectName The new project name.
   */
  private projectChangeHandler = (projectName: string) => {
    this.updateActiveProject(projectName);
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

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isInitialized The new ZenML client state.
   */
  private zenmlClientStateChangeHandler = (isInitialized: boolean) => {
    this.zenmlClientReady = isInitialized;
    if (!isInitialized) {
      this.triggerLoadingState('projects');
    } else {
      this.refresh();

      this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
      this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    }
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
      return [LOADING_TREE_ITEMS.get('zenmlClient')!];
    }

    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<ProjectsResponse>('listProjects', [
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
          console.error(`Failed to fetch projects: ${result.error}`);
          return [];
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
            new ProjectTreeItem(project, project.name, this.isActiveProject(project.name))
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
   * Checks both by ID and by name to handle different notification scenarios.
   *
   * @param {string} projectName The name of the project.
   * @returns {boolean} True if the project is active; otherwise, false.
   */
  private isActiveProject(projectName: string): boolean {
    const activeProjectName = getActiveProjectNameFromConfig();
    if (projectName === activeProjectName) {
      return true;
    }

    return false;
  }

  /**
   * Updates the active project status in the tree view without refetching all projects.
   * This is more efficient than a full refresh when only the active project changes.
   *
   * @param {string} activeProjectName The name of the newly active project.
   */
  public updateActiveProject(activeProjectName: string): void {
    // Skip full refresh if there are no items yet
    if (!this.items || this.items.length === 0 || !(this.items[0] instanceof ProjectTreeItem)) {
      return;
    }

    this.items.forEach(item => {
      if (item instanceof ProjectTreeItem) {
        const wasActive = item.isActive;
        item.isActive = item.project.name === activeProjectName;

        // Update icon and children if active state changed
        if (wasActive !== item.isActive) {
          if (item.isActive) {
            item.iconPath = new ThemeIcon('pass-filled', new ThemeColor('charts.green'));
          } else {
            item.iconPath = new ThemeIcon('symbol-method');
          }

          // Update the children items to reflect the new active status
          item.updateChildren();

          // Fire change event only for this item
          this._onDidChangeTreeData.fire(item);
        }
      }
    });
  }
}
