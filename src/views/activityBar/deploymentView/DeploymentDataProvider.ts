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
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import {
  Deployment,
  DeploymentsData,
  DeploymentsResponse,
  DeploymentSnapshot,
} from '../../../types/DeploymentTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
} from '../../../utils/constants';
import { TtlCache } from '../../../utils/ttlCache';
import { CONTEXT_VALUES } from '../../../utils/ui-constants';
import {
  createAuthErrorItem,
  createErrorItem,
  createServicesNotAvailableItem,
  ErrorTreeItem,
} from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import { DeploymentDetailTreeItem, DeploymentTreeItem } from './DeploymentTreeItems';

export class DeploymentDataProvider extends PaginatedDataProvider {
  private static instance: DeploymentDataProvider | null = null;
  private activeProjectName: string | undefined;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  private lsClientReady = false;
  private pollingTimer: NodeJS.Timeout | undefined;
  private isPolling = false;
  private readonly requestCache: TtlCache<DeploymentsResponse>;

  constructor() {
    super();
    this.items = [LOADING_TREE_ITEMS.get('deployments')!];
    this.viewName = 'Deployments';
    this.requestCache = new TtlCache<DeploymentsResponse>(this.getPollingIntervalMs());
    this.subscribeToEvents();
  }

  /**
   * Retrieves the singleton instance of DeploymentDataProvider.
   *
   * @returns {DeploymentDataProvider} The singleton instance.
   */
  public static getInstance(): DeploymentDataProvider {
    if (!DeploymentDataProvider.instance) {
      DeploymentDataProvider.instance = new DeploymentDataProvider();
    }
    return DeploymentDataProvider.instance;
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
    treeItem.contextValue = 'deploymentMessage';
    return treeItem;
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
  private projectChangeHandler = (projectName?: string) => {
    if (projectName && projectName !== this.activeProjectName) {
      this.activeProjectName = projectName;
      this.requestCache.clear();
      if (this.lsClientReady && this.zenmlClientReady) {
        this.refresh(projectName);
      }
    }
  };

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private lsClientStateChangeHandler = (status: State) => {
    if (status !== State.Running) {
      this.lsClientReady = false;
      this.stopPolling();
      this.items = [createServicesNotAvailableItem()];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.lsClientReady = true;
      this.refresh();
      this.startPolling();
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
      this.stopPolling();
      this.items = [
        this.createInitialMessage(
          'ZenML client not initialized. See Environment view for details.'
        ),
      ];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.refresh();
      this.startPolling();
    }
  };

  /**
   * Refreshes the "Deployments" view by fetching the latest deployment data and updating the view.
   *
   * @param {string} projectName - (Optional) The name of the project to fetch deployments for.
   * @returns A promise resolving to void.
   */
  public async refresh(projectName?: string): Promise<void> {
    this.triggerLoadingState('deployments');
    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    if (projectName && projectName !== this.activeProjectName) {
      this.activeProjectName = projectName;
    }

    if (!this.activeProjectName && !projectName) {
      const activeProjectName = getActiveProjectNameFromConfig();
      this.activeProjectName = activeProjectName;
    }

    const targetProject = projectName ?? this.activeProjectName;

    try {
      const newDeploymentData = await this.fetchDeployments(page, itemsPerPage, targetProject);
      this.items = newDeploymentData;
    } catch (error: any) {
      this.items = createErrorItem(error);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Fetches deployments from the server and maps them to tree items for display.
   *
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - (Optional) The name of the project to fetch deployments for.
   * @returns {Promise<TreeItem[]>} A promise resolving to an array of DeploymentTreeItems representing fetched deployments.
   */
  public async fetchDeployments(
    page: number = 1,
    itemsPerPage: number = 20,
    projectName?: string
  ): Promise<TreeItem[]> {
    if (!this.lsClientReady || !this.zenmlClientReady) {
      return [createServicesNotAvailableItem()];
    }

    try {
      const result = await this.getDeploymentsData(page, itemsPerPage, projectName);

      if (this.isErrorResponse(result)) {
        return this.handleErrorResponse(result);
      }

      if ('deployments' in result) {
        this.updatePagination(result);

        if (result.deployments.length === 0) {
          return this.createNoDeploymentsFoundItem();
        }

        return this.createDeploymentTreeItems(result.deployments);
      }

      console.error(`Unexpected response format:`, result);
      return [];
    } catch (error: any) {
      console.error(`Failed to fetch deployments: ${error}`);
      return [
        new ErrorTreeItem(
          'Error',
          `Failed to fetch deployments: ${error.message || error.toString()}`
        ),
      ];
    }
  }

  /**
   * Fetches deployment data from the server with caching.
   *
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - The name of the project to fetch deployments for.
   * @returns {Promise<DeploymentsResponse | any>} A promise resolving to the deployments data.
   */
  private async getDeploymentsData(
    page: number,
    itemsPerPage: number,
    projectName?: string
  ): Promise<DeploymentsResponse | any> {
    const cacheKey = `deployments-${page}-${itemsPerPage}-${projectName || 'default'}`;
    const cached = this.requestCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const lsClient = LSClient.getInstance();
    const data = await lsClient.sendLsClientRequest<DeploymentsResponse>('listDeployments', [
      page,
      itemsPerPage,
      projectName,
    ]);

    this.requestCache.set(cacheKey, data);

    return data;
  }

  /**
   * Checks if the response is an error.
   *
   * @param {any} result - The response to check.
   * @returns {boolean} True if the response is an error, false otherwise.
   */
  private isErrorResponse(result: any): boolean {
    return (
      (Array.isArray(result) && result.length === 1 && 'error' in result[0]) ||
      !result ||
      'error' in result ||
      ('clientVersion' in result && 'serverVersion' in result)
    );
  }

  /**
   * Handles error responses from the server.
   *
   * @param {any} result - The response to handle.
   * @returns {TreeItem[]} A tree item for the error.
   */
  private handleErrorResponse(result: any): TreeItem[] {
    if (Array.isArray(result) && result.length === 1 && 'error' in result[0]) {
      const errorMessage = result[0].error;
      if (
        errorMessage.includes('Authentication error') ||
        errorMessage.includes('Not authorized')
      ) {
        return createAuthErrorItem(errorMessage);
      }
      return createErrorItem({
        errorType: errorMessage.includes('Not authorized') ? 'AuthorizationException' : 'Error',
        message: errorMessage,
      });
    }

    if (!result || 'error' in result) {
      if (result?.message?.includes('No project')) {
        return createErrorItem({
          errorType: 'RuntimeError',
          message: 'No project found. Register a project to see it listed here.',
        });
      }
      if ('clientVersion' in result && 'serverVersion' in result) {
        return createErrorItem(result);
      }
      if (result.error?.includes('Not authorized')) {
        return createErrorItem({
          errorType: 'AuthorizationException',
          message: result.error,
        });
      }
      return createErrorItem({
        errorType: 'Error',
        message: result.error || 'Unknown error occurred',
      });
    }

    return createErrorItem({ message: 'Unknown error occurred' });
  }

  /**
   * Updates pagination based on the response.
   *
   * @param {DeploymentsData} result - The response to update pagination from.
   */
  private updatePagination(result: DeploymentsData): void {
    const { total, total_pages, current_page, items_per_page } = result;
    this.pagination = {
      currentPage: current_page,
      itemsPerPage: items_per_page,
      totalItems: total,
      totalPages: total_pages,
    };
  }

  /**
   * Creates a TreeItem for when no deployments are found.
   *
   * @returns {TreeItem[]} A tree item for when no deployments are found.
   */
  private createNoDeploymentsFoundItem(): TreeItem[] {
    const noDeploymentsItem = new TreeItem(
      `No deployments found${this.activeProjectName ? ` for project '${this.activeProjectName}'` : ''}`
    );
    noDeploymentsItem.contextValue = CONTEXT_VALUES.NO_DEPLOYMENTS;
    noDeploymentsItem.iconPath = new vscode.ThemeIcon('info');
    noDeploymentsItem.tooltip = 'Create a deployment to see it listed here';
    return [noDeploymentsItem];
  }

  /**
   * Creates tree items for deployments.
   *
   * @param {Deployment[]} deployments - The deployments to create tree items for.
   * @returns {DeploymentTreeItem[]} The deployment tree items.
   */
  private createDeploymentTreeItems(deployments: Deployment[]): DeploymentTreeItem[] {
    return deployments.map(deployment => this.createDeploymentTreeItem(deployment));
  }

  /**
   * Creates a tree item for a single deployment with detail children.
   *
   * @param {Deployment} deployment - The deployment to create a tree item for.
   * @returns {DeploymentTreeItem} The deployment tree item.
   */
  private createDeploymentTreeItem(deployment: Deployment): DeploymentTreeItem {
    const children: DeploymentDetailTreeItem[] = [];

    children.push(new DeploymentDetailTreeItem('status', deployment.status, 'status'));

    if (deployment.url) {
      children.push(new DeploymentDetailTreeItem('url', deployment.url, 'link'));
    }

    children.push(
      new DeploymentDetailTreeItem(
        'pipeline',
        this.formatOptionalValue(deployment.pipelineName, 'None'),
        'pipeline'
      ),
      new DeploymentDetailTreeItem(
        'snapshot',
        this.formatSnapshot(deployment.snapshot),
        'snapshot'
      ),
      new DeploymentDetailTreeItem(
        'stack',
        this.formatOptionalValue(deployment.stackName, 'None'),
        'stack'
      ),
      new DeploymentDetailTreeItem(
        'deployer',
        this.formatOptionalValue(deployment.deployerName, 'None'),
        'deployer'
      ),
      new DeploymentDetailTreeItem(
        'owner',
        this.formatOptionalValue(deployment.userName ?? deployment.userId, 'Unknown'),
        'owner'
      ),
      new DeploymentDetailTreeItem(
        'created',
        this.formatTimestamp(deployment.createdAt),
        'created'
      ),
      new DeploymentDetailTreeItem('updated', this.formatTimestamp(deployment.updatedAt), 'updated')
    );

    return new DeploymentTreeItem(deployment, children);
  }

  private formatOptionalValue(value: string | null | undefined, fallback: string): string {
    if (typeof value !== 'string') {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private formatSnapshot(snapshot: DeploymentSnapshot | null): string {
    if (!snapshot) {
      return 'None';
    }
    const snapshotName = this.formatOptionalValue(snapshot.name || snapshot.id, 'Unknown');
    const snapshotVersion = this.formatOptionalValue(snapshot.version, 'Unknown');
    const snapshotCreatedAt = this.formatOptionalValue(snapshot.createdAt, 'Unknown');
    return `${snapshotName} (version: ${snapshotVersion}, created: ${snapshotCreatedAt})`;
  }

  private formatTimestamp(value: string | null | undefined): string {
    if (!value) {
      return 'Unknown';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }

  private getPollingIntervalMs(): number {
    const intervalSeconds = vscode.workspace
      .getConfiguration('zenml')
      .get<number>('deployments.refreshInterval', 15);
    if (!intervalSeconds || intervalSeconds <= 0) {
      return 0;
    }
    return intervalSeconds * 1000;
  }

  public startPolling(): void {
    const intervalMs = this.getPollingIntervalMs();
    if (!intervalMs) {
      this.stopPolling();
      return;
    }
    if (!this.lsClientReady || !this.zenmlClientReady) {
      return;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.isPolling = true;
    this.pollingTimer = setInterval(() => {
      void this.poll();
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
    this.isPolling = false;
  }

  private async poll(): Promise<void> {
    if (!this.isPolling || !this.lsClientReady || !this.zenmlClientReady) {
      return;
    }
    await this.refresh();
  }

  public dispose(): void {
    this.stopPolling();
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
  }
}
