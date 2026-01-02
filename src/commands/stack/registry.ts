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
import { ExtensionContext, commands } from 'vscode';
import { registerCommand } from '../../common/vscodeapi';
import { ZenExtension } from '../../services/ZenExtension';
import { StackDataProvider, StackTreeItem } from '../../views/activityBar';
import { stackCommands } from './cmds';

/**
 * Registers stack-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerStackCommands = (context: ExtensionContext) => {
  const stackDataProvider = StackDataProvider.getInstance();
  try {
    const registeredCommands = [
      registerCommand('zenml.setStackItemsPerPage', async () =>
        stackDataProvider.updateItemsPerPage()
      ),
      registerCommand('zenml.refreshStackView', async () => stackCommands.refreshStackView()),
      registerCommand('zenml.registerStack', async () => stackCommands.registerStack()),
      registerCommand('zenml.updateStack', async (node: StackTreeItem) =>
        stackCommands.updateStack(node)
      ),
      registerCommand('zenml.deleteStack', async (node: StackTreeItem) =>
        stackCommands.deleteStack(node)
      ),
      registerCommand('zenml.renameStack', async (node: StackTreeItem) =>
        stackCommands.renameStack(node)
      ),
      registerCommand('zenml.setActiveStack', async (node: StackTreeItem) =>
        stackCommands.setActiveStack(node)
      ),
      registerCommand('zenml.goToStackUrl', (node: StackTreeItem) =>
        stackCommands.goToStackUrl(node)
      ),
      registerCommand('zenml.copyStack', async (node: StackTreeItem) =>
        stackCommands.copyStack(node)
      ),
      registerCommand('zenml.nextStackPage', async () => stackDataProvider.goToNextPage()),
      registerCommand('zenml.previousStackPage', async () => stackDataProvider.goToPreviousPage()),
    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'stackCommandsRegistered', true);
  } catch (error) {
    console.error('Error registering stack commands:', error);
    commands.executeCommand('setContext', 'stackCommandsRegistered', false);
  }
};
