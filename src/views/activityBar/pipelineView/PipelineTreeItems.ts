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
import { PipelineRun } from '../../../types/PipelineTypes';
import { PIPELINE_RUN_STATUS_ICONS } from '../../../utils/constants';

/**
 * Represents a Pipeline Run Tree Item in the VS Code tree view.
 * Displays its name, version and status.
 */
export class PipelineTreeItem extends vscode.TreeItem {
  public children: PipelineRunTreeItem[] | undefined;

  constructor(
    public readonly run: PipelineRun,
    public readonly id: string,
    children?: PipelineRunTreeItem[]
  ) {
    super(
      run.name,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.tooltip = `${run.name} - Status: ${run.status}`;
    this.iconPath = PIPELINE_RUN_STATUS_ICONS[run.status];
    this.children = children;
  }

  contextValue = 'pipelineRun';
}

/**
 * Represents details of a Pipeline Run Tree Item in the VS Code tree view.
 * Displays the stack name for the run, its start time, end time, machine details, Python version, and more.
 */
export class PipelineRunTreeItem extends vscode.TreeItem {
  public children?: PipelineRunTreeItem[];

  constructor(
    public readonly label: string,
    public readonly description: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.tooltip = '';
  }

  contextValue = 'pipelineRunDetail';
}
