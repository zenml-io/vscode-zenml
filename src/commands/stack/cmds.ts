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
import { StackDataProvider, StackTreeItem } from '../../views/activityBar';
import ZenMLStatusBar from '../../views/statusBar';
import { switchActiveStack } from './utils';
import { LSClient } from '../../services/LSClient';
import { GenericLSClientResponse } from '../../types/LSClientResponseTypes';
import { PYTOOL_MODULE } from '../../utils/constants';
import { showInformationMessage } from '../../utils/notifications';

/**
 * Refreshes the stack view.
 */
const refreshStackView = async () => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Refreshing Stack View...',
      cancellable: false,
    },
    async progress => {
      await StackDataProvider.getInstance().refresh();
    }
  );
};

/**
 * Refreshes the active stack.
 */
const refreshActiveStack = async () => {
  const statusBar = ZenMLStatusBar.getInstance();

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

/**
 * Renames the selected stack to a new name.
 *
 * @param node The stack to rename.
 * @returns {Promise<void>} Resolves after renaming the stack.
 */
const renameStack = async (node: StackTreeItem): Promise<void> => {
  const newStackName = await vscode.window.showInputBox({ prompt: 'Enter new stack name' });
  if (!newStackName) {
    return;
  }

  const lsClient = LSClient.getInstance().getLanguageClient();
  if (!lsClient) {
    console.log('Language server is not available.');
    return;
  }

  const { label, id } = node;

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Renaming Stack...',
      cancellable: false,
    },
    async () => {
      try {
        const result = (await lsClient.sendRequest('workspace/executeCommand', {
          command: `${PYTOOL_MODULE}.renameStack`,
          arguments: [id, newStackName],
        })) as GenericLSClientResponse;

        if ('error' in result && result.error) {
          throw new Error(result.error);
        }

        showInformationMessage(`Stack ${label} successfully renamed to ${newStackName}.`);
        await StackDataProvider.getInstance().refresh();
      } catch (error: any) {
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
 */
const copyStack = async (node: StackTreeItem) => {
  const newStackName = await vscode.window.showInputBox({
    prompt: 'Enter the name for the copied stack',
  });
  if (!newStackName) {
    return;
  }

  const lsClient = LSClient.getInstance().getLanguageClient();
  if (!lsClient) {
    console.log('Language server is not available.');
    return false;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Copying Stack...',
      cancellable: false,
    },
    async progress => {
      try {
        const result = (await lsClient.sendRequest('workspace/executeCommand', {
          command: `${PYTOOL_MODULE}.copyStack`,
          arguments: [node.id, newStackName],
        })) as GenericLSClientResponse;

        if ('error' in result && result.error) {
          throw new Error(result.error);
        }

        showInformationMessage('Stack copied successfully.');

        await StackDataProvider.getInstance().refresh();
      } catch (error: any) {
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
 * @param {StackTreeItem} node The stack to activate.
 * @returns {Promise<void>} Resolves after setting the active stack.
 */
const setActiveStack = async (node: StackTreeItem): Promise<void> => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Setting Active Stack...',
      cancellable: false,
    },
    async () => {
      try {
        const result = await switchActiveStack(node.id);
        if (result) {
          const { id, name } = result;
          showInformationMessage(`Active stack set to: ${name}`);
          await refreshActiveStack();
          await StackDataProvider.getInstance().refresh();
        }
      } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage(`Failed to set active stack: ${error}`);
      }
    }
  );
};

export const stackCommands = {
  refreshStackView,
  refreshActiveStack,
  renameStack,
  copyStack,
  setActiveStack,
};
