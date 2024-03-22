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
import * as vscode from 'vscode';
import { PipelineRunTreeItem, PipelineTreeItem } from './PipelineTreeItems';
import { PipelineRun, PipelineRunsResponse } from '../../../types/PipelineTypes';
import { LSClient } from '../../../services/LSClient';

/**
 * Provides data for the pipeline run tree view, displaying detailed information about each pipeline run.
 */
export class PipelineDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private static instance: PipelineDataProvider | null = null;

  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;

  constructor() { }

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
    await this.fetchPipelineRuns();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Retrieves the tree item for a given pipeline run.
   *
   * @param element The pipeline run item.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Retrieves the children for a given tree item.
   *
   * @param element The parent tree item. If undefined, root pipeline runs are fetched.
   * @returns A promise resolving to an array of child tree items or undefined if there are no children.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (!element) {
      return this.fetchPipelineRuns();
    } else {
      return element instanceof PipelineTreeItem ? element.children : undefined;
    }
  }

  /**
   * Fetches pipeline runs from the server and maps them to tree items for display.
   *
   * @returns A promise resolving to an array of PipelineTreeItems representing fetched pipeline runs.
   */
  async fetchPipelineRuns(): Promise<PipelineTreeItem[]> {
    try {
      const lsClient = LSClient.getInstance();
      if (!lsClient.clientReady) {
        return [];
      }

      const result =
        await lsClient.sendLsClientRequest<PipelineRunsResponse>('getPipelineRuns');
      if (!result || (result && 'error' in result)) {
        return [];
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
      console.error('Failed to fetch pipeline runs:', error);
      return [];
    }
  }
}
