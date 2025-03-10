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
import { TreeItem } from 'vscode';
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { PipelineRun, PipelineRunsResponse } from '../../../types/PipelineTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_STACK_CHANGED,
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
        this.items = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
        this._onDidChangeTreeData.fire(undefined);
        return;
      }

      this.refresh();
      this.eventBus.off(LSP_ZENML_STACK_CHANGED, () => this.refresh());
      this.eventBus.on(LSP_ZENML_STACK_CHANGED, () => this.refresh());
    });
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
   * Refreshes the "Pipeline Runs" view by fetching the latest pipeline run data and updating the view.
   *
   * @returns A promise resolving to void.
   */
  public async refresh(): Promise<void> {
    this.items = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
    this._onDidChangeTreeData.fire(undefined);
    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newPipelineData = await this.fetchPipelineRuns(page, itemsPerPage);
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
  async fetchPipelineRuns(page: number = 1, itemsPerPage: number = 20): Promise<TreeItem[]> {
    if (!this.zenmlClientReady) {
      return [LOADING_TREE_ITEMS.get('zenmlClient')!];
    }
    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<PipelineRunsResponse>('getPipelineRuns', [
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
          console.error(`Failed to fetch pipeline runs: ${result.error}`);
          return [];
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
