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
import { ZenMLClient } from '../../../services/ZenMLClient';
import { PipelineRunTreeItem, PipelineTreeItem } from './PipelineTreeItems';
import { PipelineRun } from '../../../types/PipelineTypes';

/**
 * Provides data for the pipeline run tree view, displaying detailed information about each pipeline run.
 */
export class PipelineDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private isActive = true;
  private apiClient: ZenMLClient = ZenMLClient.getInstance();

  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;

  constructor() {
    this.isActive = true;
  }

  /**
   * Retrieves the tree item for a given pipeline run.
   * @param element The pipeline run item.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Asynchronously retrieves the children for a given tree item.
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
    if (!this.isActive) {
      console.log('PipelineDataProvider is not active, skipping fetch.');
      return [];
    }

    try {
      const response = await this.apiClient.request('get', '/runs?hydrate=true');
      const pipelineRuns: PipelineRun[] = response.items.map((item: any) => ({
        id: item.id,
        name: item.body.pipeline.name,
        status: item.body.status,
        version: item.body.pipeline.body.version,
        stackName: item.body.stack.name,
        startTime: item.metadata.start_time,
        endTime: item.metadata.end_time,
        os: item.metadata.client_environment.os,
        osVersion: item.metadata.client_environment.mac_version,
        pythonVersion: item.metadata.client_environment.python_version,
      }));

      return pipelineRuns.map(run => {
        const children = [
          new PipelineRunTreeItem('stack', run.stackName),
          new PipelineRunTreeItem('start time', run.startTime),
          new PipelineRunTreeItem('end time', run.endTime),
          new PipelineRunTreeItem('os', `${run.os} ${run.osVersion}`),
          new PipelineRunTreeItem('python version', run.pythonVersion),
        ];

        return new PipelineTreeItem(run, children);
      });
    } catch (error) {
      console.error('Failed to fetch pipeline runs:', error);
      vscode.window.showErrorMessage('Failed to fetch pipeline runs. See console for details.');
      return [];
    }
  }

  /**
   * Refreshes the "Pipeline Runs" view by fetching the latest pipeline run data and updating the view.
   */
  public async refresh(): Promise<void> {
    const pipelineRuns = await this.fetchPipelineRuns();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Resets the tree view data by setting isActive to false and emitting an event with 'undefined'.
   */
  public reset(): void {
    this.isActive = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Reactivates the tree view data by setting isActive to true.
   */
  public reactivate(): void {
    this.isActive = true;
  }
}
