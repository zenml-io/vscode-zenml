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
import { StackComponentTreeItem, StackTreeItem } from './StackTreeItems';
import { StackComponent, Stack } from '../../../types/StackTypes';

/**
 * Supplies data for the stack tree view in the Activity Bar.
 * Implements the vscode TreeDataProvider interface, providing stack-related data to a TreeView component.
 */
export class StackDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private isActive = false;
  private context: vscode.ExtensionContext;
  private apiClient: ZenMLClient = ZenMLClient.getInstance();

  constructor(context: vscode.ExtensionContext) {
    this.isActive = true;
    this.context = context;
  }

  /**
   * Refreshes the tree view data by refetching stacks and triggering the onDidChangeTreeData event.
   */
  public async refresh(): Promise<void> {
    await this.fetchStacksWithComponents();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Resets the tree view data by emitting an event with 'undefined'.
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

  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> =
    this._onDidChangeTreeData.event;

  /**
   * Returns the provided tree item.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Asynchronously retrieves the children of a given tree item.
   * If no element is provided, it fetches the root stacks.
   *
   * @param {vscode.TreeItem} element The parent tree item.
   * @returns {Promise<vscode.TreeItem[] | undefined>} A promise that resolves to an array of child tree items.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[] | undefined> {
    if (element instanceof StackTreeItem) {
      return element.children;
    } else if (!element) {
      return this.fetchStacksWithComponents();
    }
  }

  async fetchComponentsForStack(stackId: string): Promise<StackComponent[]> {
    const accessToken = vscode.workspace.getConfiguration('zenml').get('accessToken');
    if (!accessToken) {
      return [];
    }
    try {
      const stackResponse = await this.apiClient.request('get', `/stacks/${stackId}`);
      const components: Record<string, any[]> = stackResponse.metadata.components;
      if (!components) {
        console.log('No components data found or unexpected response structure:', stackResponse);
        return [];
      }

      const stackComponents: StackComponent[] = Object.entries(components).flatMap(
        ([type, componentsArray]: [string, any[]]) =>
          componentsArray.map((component: any) => ({
            id: component.id,
            name: component.name,
            type: component.body.type,
            flavor: component.body.flavor,
            workspaceId: stackResponse.metadata.workspace.id,
          }))
      );

      return stackComponents;
    } catch (error) {
      console.error('Failed to fetch components:', error);
      throw new Error('Failed to fetch components');
    }
  }

  /**
   * Fetches all stacks along with their components from the server.
   * This function utilizes the `hydrate=true` query parameter to fetch detailed
   * information about each stack, including its components in a single API call.
   * The fetched stacks are then converted into `StackTreeItem` objects for display
   * in the VS Code TreeView.
   *
   * @returns {Promise<StackTreeItem[]>} A promise that resolves to an array of `StackTreeItem` objects.
   */
  private async fetchStacksWithComponents(): Promise<StackTreeItem[]> {
    if (!this.isActive) {
      return [];
    }

    try {
      const response = await this.apiClient.request('get', '/stacks?hydrate=true');
      const activeStackId = vscode.workspace.getConfiguration('zenml').get<string>('activeStackId');

      return response.items.map((stack: any) => {
        const isActive = stack.id === activeStackId;
        return this.convertToStackTreeItem(stack, isActive);
      });
    } catch (error) {
      console.error('Failed to fetch stacks with components:', error);
      vscode.window.showErrorMessage('Failed to fetch stacks. See console for details.');
      return [];
    }
  }

  /**
   * Converts a stack object fetched from the API into a `StackTreeItem` object.
   * This method processes the stack object to extract its components and creates
   * `StackComponentTreeItem` objects for each component. These component items are
   * then used to instantiate and return a `StackTreeItem` object.
   *
   * @param {any} stack - The stack object fetched from the API.
   * @returns {StackTreeItem} A `StackTreeItem` object representing the stack and its components.
   */
  private convertToStackTreeItem(stack: any, isActive: boolean): StackTreeItem {
    const components: Record<string, any[]> = stack.metadata.components;
    const componentTreeItems = Object.entries(components).flatMap(
      ([type, componentsArray]: [string, any[]]) =>
        componentsArray.map(
          component =>
            new StackComponentTreeItem(
              {
                id: component.id,
                name: component.name,
                type: component.body.type,
                flavor: component.body.flavor,
                workspaceId: stack.metadata.workspace.id,
              },
              stack.id
            )
        )
    );

    return new StackTreeItem(stack.name, stack.id, componentTreeItems, isActive);
  }
}
