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
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { Stack, StackComponent, StacksReponse } from '../../../types/StackTypes';
import { StackComponentTreeItem, StackTreeItem } from './StackTreeItems';

export class StackDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private static instance: StackDataProvider | null = null;
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  public stacks: Stack[] = [];
  private eventBus = EventBus.getInstance();

  constructor() {
    this.subscribeToEvents();
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.on('zenmlReadt/lsClientReady', (isReady: boolean) => {
      this.eventBus.off('stackChanged', this.refresh);
      this.eventBus.on('stackChanged', this.refresh);
      this.refresh();
    })
  }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {StackDataProvider} The singleton instance.
   */
  public static getInstance(): StackDataProvider {
    if (!this.instance) {
      this.instance = new StackDataProvider();
    }
    return this.instance;
  }

  /**
   * Refreshes the tree view data by refetching stacks and triggering the onDidChangeTreeData event.
   *
   * @returns {Promise<void>} A promise that resolves when the tree view data has been refreshed.
   */
  public async refresh(): Promise<void> {
    await this.fetchStacksWithComponents();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Returns the provided tree item.
   *
   * @param {vscode.TreeItem} element The tree item to return.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Retrieves the children of a given tree item.
   *
   * @param {vscode.TreeItem} element The tree item whose children to retrieve.
   * @returns A promise resolving to an array of child tree items or undefined if there are no children.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (element instanceof StackTreeItem) {
      return element.children;
    } else if (!element) {
      return await this.fetchStacksWithComponents();
    }
  }

  /**
   * Retrieves detailed stack information, including components, from the server.
   *
   * @returns {Promise<StackTreeItem[]>} A promise that resolves with an array of `StackTreeItem` objects.
   */
  async fetchStacksWithComponents(): Promise<StackTreeItem[]> {
    const lsClient = LSClient.getInstance();
    if (!lsClient.clientReady) {
      this.stacks = [];
      return [];
    }

    try {
      const stacks = await lsClient.sendLsClientRequest<StacksReponse>('fetchStacks');
      if (!stacks || (stacks && 'error' in stacks)) {
        this.stacks = [];
        return [];
      }

      return stacks.map((stack: Stack) => {
        const activeStackId = vscode.workspace
          .getConfiguration('zenml')
          .get<string>('activeStackId');
        const isActive = stack.id === activeStackId;
        this.stacks = stacks;
        return this.convertToStackTreeItem(stack, isActive);
      });
    } catch (error) {
      console.error('Failed to fetch stacks with components:', error);
      return [];
    }
  }

  /**
   * Transforms a stack from the API into a `StackTreeItem` with component sub-items.
   *
   * @param {any} stack - The stack object fetched from the API.
   * @returns {StackTreeItem} A `StackTreeItem` object representing the stack and its components.
   */
  private convertToStackTreeItem(stack: Stack, isActive: boolean): StackTreeItem {
    const componentTreeItems = Object.entries(stack.components).flatMap(([type, componentsArray]) =>
      componentsArray.map(
        (component: StackComponent) => new StackComponentTreeItem(component, stack.id)
      )
    );
    return new StackTreeItem(stack.name, stack.id, componentTreeItems, isActive);
  }
}
