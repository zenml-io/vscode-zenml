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
import {
  LSCLIENT_STATE_CHANGED,
  LSP_IS_ZENML_INSTALLED,
  REFRESH_ENVIRONMENT_VIEW,
  LSP_ZENML_CLIENT_INITIALIZED,
} from '../../../utils/constants';
import { EnvironmentItem } from './EnvironmentItem';
import {
  createInterpreterDetails,
  createLSClientItem,
  createWorkspaceSettingsItems,
  createZenMLInstallationItem,
  createZenMLClientStatusItem,
} from './viewHelpers';
import { LSNotificationIsZenMLInstalled } from '../../../types/LSNotificationTypes';

export class EnvironmentDataProvider implements TreeDataProvider<TreeItem> {
  private static instance: EnvironmentDataProvider | null = null;
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lsClientStatus: State = State.Stopped;
  private zenmlClientReady: boolean = false;
  private zenmlInstallationStatus: LSNotificationIsZenMLInstalled | null = null;
  private items: EnvironmentItem[] = [];

  private eventBus = EventBus.getInstance();

  constructor() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.handleLsClientStateChange.bind(this));
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.handleZenMLClientStateChange.bind(this));
    this.eventBus.on(LSP_IS_ZENML_INSTALLED, this.handleIsZenMLInstalled.bind(this));
    this.eventBus.on(REFRESH_ENVIRONMENT_VIEW, this.refresh.bind(this));
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
   * Explicitly trigger loading state for ZenML installation check and ZenML client initialization.
   */
  private triggerLoadingStateForZenMLChecks() {
    this.zenmlClientReady = false;
    this.zenmlInstallationStatus = null;
    this.refresh();
  }

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private handleLsClientStateChange(status: State) {
    this.lsClientStatus = status;
    if (status !== State.Running) {
      this.triggerLoadingStateForZenMLChecks();
    }
    this.refresh();
  }

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isReady The new ZenML client state.
   */
  private handleZenMLClientStateChange(isReady: boolean) {
    this.zenmlClientReady = isReady;
    this.refresh();
  }

  /**
   * Handles the change in the ZenML installation status.
   *
   * @param {LSNotificationIsZenMLInstalled} params The new ZenML installation status.
   */
  private handleIsZenMLInstalled(params: LSNotificationIsZenMLInstalled) {
    this.zenmlInstallationStatus = params;
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
    const items: EnvironmentItem[] = [
      createLSClientItem(this.lsClientStatus),
      createZenMLInstallationItem(this.zenmlInstallationStatus),
      createZenMLClientStatusItem(this.zenmlClientReady),
      ...(await createInterpreterDetails()),
      ...(await createWorkspaceSettingsItems()),
    ];
    this.items = items;
    return items;
  }

  public getEnvironmentData(): EnvironmentItem[] {
    return this.items;
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
