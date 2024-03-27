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
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSCLIENT_STATE_CHANGED, REFRESH_ENVIRONMENT_VIEW } from '../../../utils/constants';
import { EnvironmentItem } from './EnvironmentItem';
import {
  createInterpreterDetails,
  createLSClientItem,
  createWorkspaceSettingsItems,
  createZenMLStatusItems,
} from './viewHelpers';

export class EnvironmentDataProvider implements TreeDataProvider<TreeItem> {
  private static instance: EnvironmentDataProvider | null = null;
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lsClientStatus: State = State.Stopped;

  private eventBus = EventBus.getInstance();

  constructor() {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.handleLsClientStateChangey.bind(this));
    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.handleLsClientStateChangey.bind(this));

    this.eventBus.off(REFRESH_ENVIRONMENT_VIEW, () => this.refresh());
    this.eventBus.on(REFRESH_ENVIRONMENT_VIEW, () => this.refresh());
  }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {PipelineDataProvider} The singleton instance.
   */
  public static getInstance(): EnvironmentDataProvider {
    if (!this.instance) {
      this.instance = new EnvironmentDataProvider();
    }
    return this.instance;
  }

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private handleLsClientStateChangey(status: State) {
    this.lsClientStatus = status;
    this.refresh();
  }

  /**
   * Refreshes the "Pipeline Runs" view by fetching the latest pipeline run data and updating the view.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Retrieves the tree item for a given pipeline run.
   *
   * @param element The pipeline run item.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: EnvironmentItem): TreeItem {
    return element;
  }

  /**
   * Adjusts createRootItems to set each item to not collapsible and directly return items for Interpreter, Workspace, etc.
   */
  private async createRootItems(): Promise<EnvironmentItem[]> {
    const items: EnvironmentItem[] = [];
    const lsClientStatusItem = createLSClientItem(this.lsClientStatus);
    items.push(lsClientStatusItem);
    items.push(...(await createZenMLStatusItems()));
    items.push(...(await createInterpreterDetails()));
    items.push(...(await createWorkspaceSettingsItems()));

    return items;
  }

  /**
   * Simplifies getChildren by always returning root items, as there are no collapsible items now.
   */
  async getChildren(element?: EnvironmentItem): Promise<TreeItem[]> {
    if (!element) {
      return this.createRootItems();
    } else {
      // Since there are no collapsible items, no need to fetch children
      return [];
    }
  }
}
