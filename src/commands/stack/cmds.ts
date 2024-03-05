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
import { ZenMLClient } from '../../services/ZenMLClient';
import { StackDataProvider, StackTreeItem } from '../../views/activityBar';
import ZenMLStatusBar from '../../views/statusBar';
import { switchZenMLStack } from './utils';

/**
 * Refreshes the stack view.
 *
 * @param {StackDataProvider} stackDataProvider - An instance of StackDataProvider that manages the data and updates the view for stack-related operations.
 */
export const refreshStackView = (stackDataProvider: StackDataProvider) => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Refreshing Stack View...',
      cancellable: false,
    },
    async progress => {
      stackDataProvider.refresh();
    }
  );
};

/**
 * Refreshes the active stack.
 *
 * @param {ZenMLStatusBar} statusBar - An instance of ZenMLStatusBar that manages the status bar for the extension.
 */
export const refreshActiveStack = async (statusBar: ZenMLStatusBar) => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Refreshing Active Stack...',
      cancellable: false,
    },
    async progress => {
      await statusBar.refreshActiveStack();
    }
  );
};

export const renameStack = async (node: StackTreeItem, stackDataProvider: StackDataProvider) => {
  const zenmlClient = ZenMLClient.getInstance();
  const newStackName = await vscode.window.showInputBox({ prompt: 'Enter new stack name' });
  if (!newStackName) {
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Renaming Stack...',
      cancellable: false,
    },
    async () => {
      try {
        const response = await zenmlClient.request('put', `/stacks/${node.id}`, {
          name: newStackName,
        });
        vscode.window.showInformationMessage('Stack renamed successfully.');
        stackDataProvider.refresh();
      } catch (error) {
        if (error.response) {
          vscode.window.showErrorMessage(`Failed to rename stack: ${error.response.data.message}`);
        } else {
          console.error('Failed to rename stack:', error);
          vscode.window.showErrorMessage('Failed to rename stack');
        }
      }
    }
  );
};

/**
 * Copies the selected stack to a new stack with a specified name.
 *
 * @param {StackTreeItem} node The stack to copy.
 * @param {StackDataProvider} stackDataProvider Updates the view to reflect the new stack.
 */
export const copyStack = async (node: StackTreeItem, stackDataProvider: StackDataProvider) => {
  const zenmlClient = ZenMLClient.getInstance();
  const targetStackName = await vscode.window.showInputBox({
    prompt: 'Enter the name for the copied stack',
  });
  if (!targetStackName) {
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Copying Stack...',
      cancellable: false,
    },
    async progress => {
      try {
        // Step 1: Fetch the stack the user wants to copy
        const stackResponse = await zenmlClient.request('get', `/stacks/${node.id}`);
        if (!stackResponse || !stackResponse.metadata || !stackResponse.metadata.components) {
          throw new Error('Stack data is incomplete or missing.');
        }
        const originalStackComponents = stackResponse.metadata.components;

        // Step 2: Extract and map component types to their corresponding IDs
        const componentMappings: { [key: string]: string[] } = {};
        for (const [componentType, components] of Object.entries(originalStackComponents)) {
          componentMappings[componentType] = (components as any[]).map(component => component.id);
        }

        // Validate component mappings before proceeding.
        if (Object.keys(componentMappings).length === 0) {
          throw new Error('No components found in the original stack.');
        }

        // Step 3: Prepare the payload for the new stack
        const workspaceId = stackResponse.metadata.workspace.id;
        if (!workspaceId) {
          throw new Error('Workspace ID is missing.');
        }
        const userId = stackResponse.body.user ? stackResponse.body.user.id : null;

        const newStackPayload = {
          name: targetStackName,
          components: componentMappings,
          user: userId,
          workspace: workspaceId,
        };

        // Step 4: Create the new stack
        const copyStackResponse = await zenmlClient.request('post', `/workspaces/${workspaceId}/stacks`, newStackPayload);
        if (!copyStackResponse || copyStackResponse.error) {
          throw new Error('Failed to create the new stack.');
        }
        vscode.window.showInformationMessage('Stack copied successfully.');
        stackDataProvider.refresh();
      } catch (error) {
        if (error.response && error.response.data && error.response.data.message) {
          vscode.window.showErrorMessage(`Failed to copy stack: ${error.response.data.message}`);
        } else {
          console.error('Failed to copy stack:', error);
          vscode.window.showErrorMessage(`Failed to copy stack: ${error.message || error}`);
        }
      }
    }
  );
};

/**
 * Sets the selected stack as the active stack and stores it in the global context.
 *
 * @param {vscode.ExtensionContext} context The extension context used for global state management.
 * @param {StackTreeItem} node The stack to activate.
 * @param {ZenMLStatusBar} statusBar Updates the status bar to show the active stack.
 * @param {StackDataProvider} stackDataProvider Updates the view to reflect the new active stack.
 */
export const setActiveStack = async (
  context: vscode.ExtensionContext,
  node: StackTreeItem,
  statusBar: ZenMLStatusBar,
  stackDataProvider: StackDataProvider
) => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Setting Active Stack...',
      cancellable: false,
    },
    async () => {
      try {
        const activatedStack = await switchZenMLStack(node.id);
        if (activatedStack) {
          vscode.window.showInformationMessage(`Active stack set to: ${node.label}`);
          await context.globalState.update('activeStackId', node.id);
          await refreshActiveStack(statusBar);
          await stackDataProvider.refresh();
        } else {
          console.log(activatedStack);
          vscode.window.showErrorMessage('Failed to set active stack: No response from server');
        }
      } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage(`Failed to set active stack: ${error}`);
      }
    }
  );
};
