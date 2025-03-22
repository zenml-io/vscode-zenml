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
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { PipelineRun, PipelineRunsResponse } from '../../../types/PipelineTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
} from '../../../utils/constants';
import { ErrorTreeItem, createAuthErrorItem, createErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import { PipelineRunTreeItem, PipelineTreeItem } from './PipelineTreeItems';

/**
 * Provides data for the pipeline run tree view, displaying detailed information about each pipeline run.
 */
export class PipelineDataProvider extends PaginatedDataProvider {
  private static instance: PipelineDataProvider | null = null;
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
    this.refresh(projectName);
  };

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private lsClientStateChangeHandler = (status: State) => {
    if (status !== State.Running) {
      this.triggerLoadingState('lsClient');
    }
    this.refresh();
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
   * @returns A promise resolving to void.
   */
  public async refresh(projectName?: string): Promise<void> {
    this.items = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
    this._onDidChangeTreeData.fire(undefined);
    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

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
   * @returns A promise resolving to an array of PipelineTreeItems representing fetched pipeline runs.
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
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<PipelineRunsResponse>('getPipelineRuns', [
        page,
        itemsPerPage,
        projectName,
      ]);

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

      if ('runs' in result) {
        const { runs, total, total_pages, current_page, items_per_page } = result;

        this.pagination = {
          currentPage: current_page,
          itemsPerPage: items_per_page,
          totalItems: total,
          totalPages: total_pages,
        };

        if (runs.length === 0) {
          const noRunsItem = new TreeItem('No pipeline runs found for this project');
          noRunsItem.contextValue = 'noRuns';
          noRunsItem.iconPath = new vscode.ThemeIcon('info');
          noRunsItem.tooltip = 'Run a pipeline in this project to see it listed here';
          return [noRunsItem];
        }

        return runs.map((run: PipelineRun) => {
          const formattedStartTime = new Date(run.startTime).toLocaleString();
          const formattedEndTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A';

          const children = [
            new PipelineRunTreeItem('run name', run.name),
            new PipelineRunTreeItem('stack', run.stackName),
            new PipelineRunTreeItem('start time', formattedStartTime),
            new PipelineRunTreeItem('end time', formattedEndTime),
            new PipelineRunTreeItem('os', `${run.os} ${run.osVersion}`),
            new PipelineRunTreeItem('python version', run.pythonVersion),
          ];

          return new PipelineTreeItem(run, run.id, children);
        });
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
}
