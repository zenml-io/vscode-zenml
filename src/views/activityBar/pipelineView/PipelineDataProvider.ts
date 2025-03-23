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
  PipelineModel,
  PipelineRun,
  PipelineRunConfig,
  PipelineRunsData,
  PipelineRunsResponse,
  PipelineRunStep,
} from '../../../types/PipelineTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
} from '../../../utils/constants';
import { createAuthErrorItem, createErrorItem, ErrorTreeItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import { TreeItemWithChildren } from '../common/TreeItemWithChildren';
import { PipelineRunTreeItem, PipelineTreeItem } from './PipelineTreeItems';

/**
 * Provides data for the pipeline run tree view, displaying detailed information about each pipeline run.
 */
export class PipelineDataProvider extends PaginatedDataProvider {
  private static instance: PipelineDataProvider | null = null;
  private activeProjectName: string | undefined;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;

  constructor() {
    super();
    this.items = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
    this.viewName = 'PipelineRuns';
    this.subscribeToEvents();
  }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {PipelineDataProvider} The singleton instance.
   */
  public static getInstance(): PipelineDataProvider {
    if (!PipelineDataProvider.instance) {
      PipelineDataProvider.instance = new PipelineDataProvider();
    }
    return PipelineDataProvider.instance;
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
  private projectChangeHandler = (projectName?: string) => {
    if (projectName && projectName !== this.activeProjectName) {
      this.activeProjectName = projectName;
      this.refresh(projectName);
    }
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
      this.triggerLoadingState('pipelineRuns');
    } else {
      this.refresh();

      this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
      this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    }
  };

  /**
   * Refreshes the "Pipeline Runs" view by fetching the latest pipeline run data and updating the view.
   *
   * @param {string} projectName - (Optional) The name of the project to fetch runs for.
   * @returns A promise resolving to void.
   */
  public async refresh(projectName?: string): Promise<void> {
    this.items = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
    this._onDidChangeTreeData.fire(undefined);
    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    if (!this.activeProjectName && !projectName) {
      const activeProjectName = getActiveProjectNameFromConfig();
      this.activeProjectName = activeProjectName;
    }

    try {
      const newPipelineData = await this.fetchPipelineRuns(page, itemsPerPage, projectName);
      this.items = newPipelineData;
    } catch (error: any) {
      this.items = createErrorItem(error);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Fetches pipeline runs from the server and maps them to tree items for display.
   *
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - (Optional) The name of the project to fetch runs for.
   * @returns {Promise<TreeItem[]>} A promise resolving to an array of PipelineTreeItems representing fetched pipeline runs.
   */
  async fetchPipelineRuns(
    page: number = 1,
    itemsPerPage: number = 20,
    projectName?: string
  ): Promise<TreeItem[]> {
    if (!this.zenmlClientReady) {
      return [LOADING_TREE_ITEMS.get('zenmlClient')!];
    }

    try {
      const result = await this.getPipelineRunsData(page, itemsPerPage, projectName);

      if (this.isErrorResponse(result)) {
        return this.handleErrorResponse(result);
      }

      if ('runs' in result) {
        this.updatePagination(result);

        if (result.runs.length === 0) {
          return this.createNoRunsFoundItem();
        }

        const groupedByPipeline = this.groupRunsByPipeline(result.runs);
        return this.createPipelineTreeItems(groupedByPipeline);
      } else {
        console.error(`Unexpected response format:`, result);
        return [];
      }
    } catch (error: any) {
      console.error(`Failed to fetch stacks: ${error}`);
      return [
        new ErrorTreeItem(
          'Error',
          `Failed to fetch pipeline runs: ${error.message || error.toString()}`
        ),
      ];
    }
  }

  /**
   * Fetches pipeline runs data from the server.
   *
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - The name of the project to fetch runs for.
   * @returns {Promise<PipelineRunsResponse | any>} A promise resolving to the pipeline runs data.
   */
  private async getPipelineRunsData(
    page: number,
    itemsPerPage: number,
    projectName?: string
  ): Promise<PipelineRunsResponse | any> {
    const lsClient = LSClient.getInstance();
    return await lsClient.sendLsClientRequest<PipelineRunsResponse>('getPipelineRuns', [
      page,
      itemsPerPage,
      projectName,
    ]);
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
      if (errorMessage.includes('Authentication error')) {
        return createAuthErrorItem(errorMessage);
      }
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
    }

    return createErrorItem({ message: 'Unknown error occurred' });
  }

  /**
   * Updates pagination based on the response.
   *
   * @param {PipelineRunsData} result - The response to update pagination from.
   */
  private updatePagination(result: PipelineRunsData): void {
    const { total, total_pages, current_page, items_per_page } = result;
    this.pagination = {
      currentPage: current_page,
      itemsPerPage: items_per_page,
      totalItems: total,
      totalPages: total_pages,
    };
  }

  /**
   * Creates a TreeItem for when no runs are found.
   *
   * @returns {TreeItem[]} A tree item for when no runs are found.
   */
  private createNoRunsFoundItem(): TreeItem[] {
    const noRunsItem = new TreeItem('No pipeline runs found for this project');
    noRunsItem.contextValue = 'noRuns';
    noRunsItem.iconPath = new vscode.ThemeIcon('info');
    noRunsItem.tooltip = 'Run a pipeline in this project to see it listed here';
    return [noRunsItem];
  }

  /**
   * Groups pipeline runs by pipeline name.
   *
   * @param {PipelineRun[]} runs - The pipeline runs to group.
   * @returns {Object} The pipeline runs grouped by pipeline name.
   */
  private groupRunsByPipeline(runs: PipelineRun[]): { [key: string]: PipelineRun[] } {
    const groupedByPipeline: { [key: string]: PipelineRun[] } = {};

    for (const run of runs) {
      const pipelineId = run.pipelineName;
      if (!groupedByPipeline[pipelineId]) {
        groupedByPipeline[pipelineId] = [];
      }
      groupedByPipeline[pipelineId].push(run);
    }

    return groupedByPipeline;
  }

  /**
   * Creates tree items for each pipeline and its runs.
   *
   * @param {Object} groupedByPipeline - The pipeline runs grouped by pipeline name.
   * @returns {TreeItem[]} A tree item for each pipeline and its runs.
   */
  private createPipelineTreeItems(groupedByPipeline: { [key: string]: PipelineRun[] }): TreeItem[] {
    return Object.entries(groupedByPipeline).map(([pipelineName, pipelineRuns]) => {
      const pipelineItem = new TreeItem(
        pipelineName,
        vscode.TreeItemCollapsibleState.Expanded
      ) as TreeItemWithChildren;

      pipelineItem.contextValue = 'pipeline';
      pipelineItem.iconPath = new vscode.ThemeIcon('symbol-interface');
      pipelineItem.tooltip = `Pipeline: ${pipelineName}`;
      pipelineItem.children = pipelineRuns.map(run => this.createPipelineRunTreeItem(run));

      return pipelineItem;
    });
  }

  /**
   * Creates a tree item for a single pipeline run.
   *
   * @param {PipelineRun} run - The pipeline run to create a tree item for.
   * @returns {PipelineTreeItem} A tree item for the pipeline run.
   */
  private createPipelineRunTreeItem(run: PipelineRun): PipelineTreeItem {
    const formattedStartTime = new Date(run.startTime).toLocaleString();
    const formattedEndTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A';
    const children: PipelineRunTreeItem[] = [];

    // Create step tree items
    if (run.steps && Object.keys(run.steps).length > 0) {
      children.push(this.createStepsTreeItem(run.steps));
    }

    // Create model tree items
    if (run.config?.model) {
      children.push(this.createModelTreeItem(run.config.model));
    }

    // Create config tree items
    if (run.config) {
      children.push(this.createConfigTreeItem(run.config));
    }

    // Add basic run information
    children.push(
      new PipelineRunTreeItem('id', run.id),
      new PipelineRunTreeItem('name', run.name),
      new PipelineRunTreeItem('pipeline', run.pipelineName),
      new PipelineRunTreeItem('stack', run.stackName),
      new PipelineRunTreeItem('start_time', formattedStartTime),
      new PipelineRunTreeItem('end_time', formattedEndTime),
      new PipelineRunTreeItem('status', run.status)
    );

    return new PipelineTreeItem(run, run.id, children);
  }

  /**
   * Creates a tree item for pipeline steps.
   *
   * @param {Object} steps - The steps to create a tree item for.
   * @returns {PipelineRunTreeItem} A tree item for the steps.
   */
  private createStepsTreeItem(steps: { [stepName: string]: PipelineRunStep }): PipelineRunTreeItem {
    const stepsItem = new PipelineRunTreeItem(
      'steps',
      '',
      vscode.TreeItemCollapsibleState.Collapsed
    );

    const stepsChildren: PipelineRunTreeItem[] = [];

    for (const [stepName, stepData] of Object.entries(steps)) {
      const stepItem = new PipelineRunTreeItem(
        stepName,
        `status: ${stepData.status}`,
        vscode.TreeItemCollapsibleState.Collapsed
      );

      const stepChildren: PipelineRunTreeItem[] = [];
      stepChildren.push(new PipelineRunTreeItem('status', stepData.status));

      if (stepData.start_time) {
        stepChildren.push(
          new PipelineRunTreeItem('start_time', new Date(stepData.start_time).toLocaleString())
        );
      }

      if (stepData.end_time) {
        stepChildren.push(
          new PipelineRunTreeItem('end_time', new Date(stepData.end_time).toLocaleString())
        );
      }

      stepItem.children = stepChildren;
      stepsChildren.push(stepItem);
    }

    stepsItem.children = stepsChildren;
    return stepsItem;
  }

  /**
   * Creates a tree item for model information.
   *
   * @param {PipelineModel} model - The model to create a tree item for.
   * @returns {PipelineRunTreeItem} A tree item for the model.
   */
  private createModelTreeItem(model: PipelineModel): PipelineRunTreeItem {
    const modelItem = new PipelineRunTreeItem(
      'model',
      model?.name || '',
      vscode.TreeItemCollapsibleState.Collapsed
    );

    const modelChildren: PipelineRunTreeItem[] = [];

    for (const [key, value] of Object.entries(model)) {
      if (key !== 'name' && value !== undefined) {
        modelChildren.push(this.createValueTreeItem(key, value));
      }
    }

    modelItem.children = modelChildren;
    return modelItem;
  }

  /**
   * Creates a tree item for config information.
   *
   * @param {PipelineRunConfig} config - The config to create a tree item for.
   * @returns {PipelineRunTreeItem} A tree item for the config.
   */
  private createConfigTreeItem(config: PipelineRunConfig): PipelineRunTreeItem {
    const configItem = new PipelineRunTreeItem(
      'config',
      '',
      vscode.TreeItemCollapsibleState.Collapsed
    );

    const configChildren: PipelineRunTreeItem[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (key !== 'model' && value !== undefined) {
        configChildren.push(this.createValueTreeItem(key, value));
      }
    }

    configItem.children = configChildren;
    return configItem;
  }

  /**
   * Creates a tree item for a key-value pair.
   *
   * @param {string} key - The key to create a tree item for.
   * @param {any} value - The value to create a tree item for.
   * @returns {PipelineRunTreeItem} A tree item for the key-value pair.
   */
  private createValueTreeItem(key: string, value: any): PipelineRunTreeItem {
    if (Array.isArray(value)) {
      return new PipelineRunTreeItem(key, value.join(', '));
    } else if (typeof value === 'object' && value !== null) {
      return new PipelineRunTreeItem(key, JSON.stringify(value));
    } else {
      return new PipelineRunTreeItem(key, String(value));
    }
  }
}
