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
import { traceError, traceInfo } from '../../common/log/logging';
import { EventBus } from '../../services/EventBus';
import { LSClient } from '../../services/LSClient';
import { ANALYTICS_TRACK } from '../../utils/constants';
import { StackDataProvider } from '../../views/activityBar/stackView/StackDataProvider';
import { StackTreeItem } from '../../views/activityBar/stackView/StackTreeItems';
import ZenMLStatusBar from '../../views/statusBar';
import StackForm from './StackForm';
import { getStackDashboardUrl, switchActiveStack } from './utils';

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  EventBus.getInstance().emit(ANALYTICS_TRACK, { event, properties });
};

/**
 * Refreshes the stack view.
 */
const refreshStackView = async () => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
    },
    async () => {
      await StackDataProvider.getInstance().refresh();
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
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Renaming Stack...',
      cancellable: false,
    },
    async () => {
      try {
        const { label, id } = node;
        const lsClient = LSClient.getInstance();
        const result = await lsClient.sendLsClientRequest('renameStack', [id, newStackName]);
        if (result && 'error' in result) {
          throw new Error(result.error);
        }
        vscode.window.showInformationMessage(`${label} renamed to ${newStackName}`);
        trackEvent('stack.renamed', { success: true });
      } catch (error: any) {
        console.error('Failed to rename stack:', error);
        vscode.window.showErrorMessage(`Failed to rename stack: ${error}`);
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
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Copying Stack...',
      cancellable: false,
    },
    async () => {
      try {
        const lsClient = LSClient.getInstance();
        const result = await lsClient.sendLsClientRequest('copyStack', [node.id, newStackName]);
        if ('error' in result && result.error) {
          throw new Error(result.error);
        }
        vscode.window.showInformationMessage(`${node.label} copied to ${newStackName}`);
        trackEvent('stack.copied', { success: true });
        await refreshStackView();
      } catch (error: any) {
        console.error('Failed to copy stack:', error);
        vscode.window.showErrorMessage(`Failed to copy stack: ${error}`);
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

          StackDataProvider.getInstance().updateActiveStack(id);
          const statusBar = ZenMLStatusBar.getInstance();
          statusBar.refreshActiveStack({ id, name });

          vscode.window.showInformationMessage(`Active stack set to: ${name}`);
          trackEvent('stack.set_active', { success: true });
        }
      } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage(`Failed to set active stack: ${error}`);
      }
    }
  );
};

/**
 * Opens the selected stack in the ZenML Dashboard in the browser
 *
 * @param {StackTreeItem} node The stack to open.
 */
const goToStackUrl = (node: StackTreeItem): void => {
  const url = getStackDashboardUrl(node.id);

  if (url) {
    try {
      const parsedUrl = vscode.Uri.parse(url);
      vscode.env.openExternal(parsedUrl);
      trackEvent('stack.open_dashboard', { hasUrl: true });
    } catch (error) {
      console.log(error);
      vscode.window.showErrorMessage(`Failed to open stack URL: ${error}`);
    }
  } else {
    trackEvent('stack.open_dashboard', { hasUrl: false });
  }
};

/**
 * Opens the stack form webview panel to a form specific to registering a new
 * stack.
 */
const registerStack = () => {
  StackForm.getInstance().registerForm();
};

/**
 * Opens the stack form webview panel to a form specific to updating a specified stack.
 * @param {StackTreeItem} node The specified stack to update.
 */
const updateStack = async (node: StackTreeItem) => {
  const { id, label: name } = node;
  const components: { [type: string]: string } = {};

  // Use originalComponents instead of children - children contains wrapped TreeItems
  // for display purposes, not the actual StackComponentTreeItem objects
  for (const item of node.getOriginalComponents()) {
    components[item.component.type] = item.component.id;
  }

  StackForm.getInstance().updateForm(id, name, components);
};

/**
 * Deletes a specified stack.
 *
 * @param {StackTreeItem} node The Stack to delete
 */
const deleteStack = async (node: StackTreeItem) => {
  const lsClient = LSClient.getInstance();

  const answer = await vscode.window.showWarningMessage(
    `Are you sure you want to delete ${node.label}? This cannot be undone.`,
    { modal: true },
    'Delete'
  );

  if (!answer) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Deleting stack ${node.label}...`,
    },
    async () => {
      const { id } = node;

      try {
        const resp = await lsClient.sendLsClientRequest('deleteStack', [id]);

        if ('error' in resp) {
          throw resp.error;
        }

        vscode.window.showInformationMessage(`${node.label} deleted`);
        traceInfo(`${node.label} deleted`);
        trackEvent('stack.deleted', { success: true });
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to delete stack: ${e}`);
        traceError(e);
        console.error(e);
      }
    }
  );
};

export const stackCommands = {
  refreshStackView,
  renameStack,
  copyStack,
  setActiveStack,
  goToStackUrl,
  registerStack,
  updateStack,
  deleteStack,
};
