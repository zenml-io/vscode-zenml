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
import { EventEmitter, TreeDataProvider, TreeItem } from 'vscode';
import { State } from 'vscode-languageclient';
import { EventBus } from '../../../services/EventBus';
import { LSNotificationIsZenMLInstalled } from '../../../types/LSNotificationTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_IS_ZENML_INSTALLED,
  LSP_ZENML_CLIENT_INITIALIZED,
  REFRESH_ENVIRONMENT_VIEW,
} from '../../../utils/constants';
import { EnvironmentItem } from './EnvironmentItem';
import {
  createInterpreterDetails,
  createLSClientItem,
  createWorkspaceSettingsItems,
  createZenMLClientStatusItem,
  createZenMLInstallationItem,
} from './viewHelpers';

export class EnvironmentDataProvider implements TreeDataProvider<TreeItem> {
  private static instance: EnvironmentDataProvider | null = null;
  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private lsClientStatus: State = State.Stopped;
  private zenmlClientReady: boolean = false;
  private zenmlInstallationStatus: LSNotificationIsZenMLInstalled | null = null;

  private eventBus = EventBus.getInstance();
  private refreshHandler = () => this.refresh();

  constructor() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.off(LSP_IS_ZENML_INSTALLED, this.zenmlInstallationStateChangeHandler);
    this.eventBus.off(REFRESH_ENVIRONMENT_VIEW, this.refreshHandler);

    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
    this.eventBus.on(LSP_IS_ZENML_INSTALLED, this.zenmlInstallationStateChangeHandler);
    this.eventBus.on(REFRESH_ENVIRONMENT_VIEW, this.refreshHandler);
  }

  /**
   * Retrieves the singleton instance of EnvironmentDataProvider.
   *
   * @returns {EnvironmentDataProvider} The singleton instance.
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
  private lsClientStateChangeHandler(status: State) {
    this.lsClientStatus = status;
    if (status !== State.Running) {
      this.zenmlClientReady = false;
      this.zenmlInstallationStatus = null;
      this.refresh();
    }
    this.refresh();
  }

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isReady The new ZenML client state.
   */
  private zenmlClientStateChangeHandler(isReady: boolean) {
    this.zenmlClientReady = isReady;
    this.refresh();
  }

  /**
   * Handles the change in the ZenML installation status.
   *
   * @param {LSNotificationIsZenMLInstalled} params The new ZenML installation status.
   */
  private zenmlInstallationStateChangeHandler(params: LSNotificationIsZenMLInstalled) {
    this.zenmlInstallationStatus = params;
    this.refresh();
  }

  /**
   * Refreshes the "Environment" view by fetching the latest environment data and updating the view.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Retrieves the tree item for a given environment item.
   *
   * @param element The environment item.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: EnvironmentItem): TreeItem {
    return element;
  }

  /**
   * Adjusts createRootItems to set each item to not collapsible and directly return items for Interpreter, Workspace, etc.
   *
   * @returns {Promise<EnvironmentItem[]>} The root items.
   */
  private async createRootItems(): Promise<EnvironmentItem[]> {
    const items: EnvironmentItem[] = [
      createLSClientItem(this.lsClientStatus),
      createZenMLInstallationItem(this.zenmlInstallationStatus),
      createZenMLClientStatusItem(this.zenmlClientReady),
      ...(await createInterpreterDetails()),
      ...(await createWorkspaceSettingsItems()),
    ];
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
