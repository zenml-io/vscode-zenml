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
import { TreeItem, TreeItemCollapsibleState, ThemeIcon } from 'vscode';

export class LoadingTreeItem extends TreeItem {
  constructor(message: string) {
    super(message, TreeItemCollapsibleState.None);
    this.description = "Refreshing...";
    this.iconPath = new ThemeIcon('sync~spin');
  }
}

// create a MAP of loading tree items and labels
export const LOADING_TREE_ITEMS = new Map<string, LoadingTreeItem>([
  ['server', new LoadingTreeItem("Refreshing Server View...")],
  ['stacks', new LoadingTreeItem("Refreshing Stacks View...")],
  ['pipelineRuns', new LoadingTreeItem("Refreshing Pipeline Runs...")],
  ['environment', new LoadingTreeItem("Refreshing Environments...")],
  ['lsClient', new LoadingTreeItem("Waiting for Language Server to start...")],
  ['zenmlClient', new LoadingTreeItem("Waiting for ZenML Client to initialize...")]
]);

