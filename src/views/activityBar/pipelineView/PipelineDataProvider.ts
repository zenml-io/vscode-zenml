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
import { EventEmitter, TreeDataProvider, TreeItem } from 'vscode';
import { LSClient } from '../../../services/LSClient';
import { PipelineRun, PipelineRunsResponse } from '../../../types/PipelineTypes';
import { createErrorItem } from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS, LoadingTreeItem } from '../common/LoadingTreeItem';
import { PipelineRunTreeItem, PipelineTreeItem } from './PipelineTreeItems';
import { EventBus } from '../../../services/EventBus';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_STACK_CHANGED,
} from '../../../utils/constants';
import { State } from 'vscode-languageclient';

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

    try {
      const newPipelineData = await this.fetchPipelineRuns();
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
      return this.pipelineRuns;
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
  async fetchPipelineRuns(): Promise<PipelineTreeItem[] | TreeItem[]> {
    if (!this.zenmlClientReady) {
      return [LOADING_TREE_ITEMS.get('zenmlClient')!];
    }
    try {
      const lsClient = LSClient.getInstance();
      const result = await lsClient.sendLsClientRequest<PipelineRunsResponse>('getPipelineRuns');
      if (!result || 'error' in result) {
        if ('clientVersion' in result && 'serverVersion' in result) {
          return createErrorItem(result);
        } else {
          console.error(`Failed to fetch pipeline runs: ${result.error}`);
          return [];
        }
      }

      return result.map((run: PipelineRun) => {
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
    } catch (error) {
      throw error;
    }
  }
}
