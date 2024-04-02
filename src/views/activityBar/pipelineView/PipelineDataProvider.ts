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
import { EventEmitter, TreeDataProvider, TreeItem, window } from 'vscode';
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { PipelineRun, PipelineRunsResponse } from '../../../types/PipelineTypes';
import {
  ITEMS_PER_PAGE_OPTIONS,
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { ErrorTreeItem, createErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PipelineRunTreeItem, PipelineTreeItem } from './PipelineTreeItems';
import { CommandTreeItem } from '../common/PaginationTreeItems';

/**
 * Provides data for the pipeline run tree view, displaying detailed information about each pipeline run.
 */
export class PipelineDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private static instance: PipelineDataProvider | null = null;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  private pipelineRuns: PipelineTreeItem[] | TreeItem[] = [LOADING_TREE_ITEMS.get('pipelineRuns')!];

  private pagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0,
  };


  constructor() {
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
        this.pipelineRuns = [LOADING_TREE_ITEMS.get('lsClient')!];
        this._onDidChangeTreeData.fire(undefined);
      }
    });

    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, (isInitialized: boolean) => {
      this.zenmlClientReady = isInitialized;

      if (!isInitialized) {
        this.pipelineRuns = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
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
    if (!this.instance) {
      this.instance = new PipelineDataProvider();
    }
    return this.instance;
  }

  /**
   * Refreshes the "Pipeline Runs" view by fetching the latest pipeline run data and updating the view.
   *
   * @returns A promise resolving to void.
   */
  public async refresh(): Promise<void> {
    this.pipelineRuns = [LOADING_TREE_ITEMS.get('pipelineRuns')!];
    this._onDidChangeTreeData.fire(undefined);
    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    try {
      const newPipelineData = await this.fetchPipelineRuns(page, itemsPerPage);
      this.pipelineRuns = newPipelineData;
    } catch (error: any) {
      this.pipelineRuns = createErrorItem(error);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Retrieves the tree item for a given pipeline run.
   *
   * @param element The pipeline run item.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  /**
   * Retrieves the children for a given tree item.
   *
   * @param element The parent tree item. If undefined, root pipeline runs are fetched.
   * @returns A promise resolving to an array of child tree items or undefined if there are no children.
   */
  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      if (Array.isArray(this.pipelineRuns) && this.pipelineRuns.length > 0) {
        return this.pipelineRuns;
      }

      const runs = await this.fetchPipelineRuns(this.pagination.currentPage, this.pagination.itemsPerPage);
      if (this.pagination.currentPage < this.pagination.totalPages) {
        runs.push(new CommandTreeItem("Next Page", 'zenml.nextPipelineRunsPage', undefined, 'arrow-circle-right'));
      }
      if (this.pagination.currentPage > 1) {
        runs.unshift(new CommandTreeItem("Previous Page", 'zenml.previousPipelineRunsPage', undefined, 'arrow-circle-left'));
      }
      return runs;
    } else if (element instanceof PipelineTreeItem) {
      return element.children;
    }
    return undefined;
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
      const result = await lsClient.sendLsClientRequest<PipelineRunsResponse>(
        'getPipelineRuns',
        [page, itemsPerPage]
      );
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
      return [new ErrorTreeItem("Error", `Failed to fetch pipeline runs: ${error.message || error.toString()}`)];
    }
  }

  public async goToNextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages) {
      this.pagination.currentPage++;
      await this.refresh();
    }
  }

  public async goToPreviousPage() {
    if (this.pagination.currentPage > 1) {
      this.pagination.currentPage--;
      await this.refresh();
    }
  }

  public async updateItemsPerPage() {
    const selected = await window.showQuickPick(ITEMS_PER_PAGE_OPTIONS, {
      placeHolder: "Choose the max number of pipeline runs to display per page",
    });
    if (selected) {
      this.pagination.itemsPerPage = parseInt(selected, 10);
      this.pagination.currentPage = 1;
      await this.refresh();
    }
  }
}
