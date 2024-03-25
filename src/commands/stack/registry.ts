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
import { StackTreeItem } from '../../views/activityBar';
import { stackCommands } from './cmds';
import { registerCommand } from '../../common/vscodeapi';
import { ZenExtension } from '../../services/ZenExtension';
import { ExtensionContext, commands } from 'vscode';

/**
 * Registers stack-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerStackCommands = (context: ExtensionContext) => {
  try {
    const registeredCommands = [
      registerCommand('zenml.refreshStackView', async () => await stackCommands.refreshStackView()),
      registerCommand(
        'zenml.refreshActiveStack',
        async () => await stackCommands.refreshActiveStack()
      ),
      registerCommand(
        'zenml.renameStack',
        async (node: StackTreeItem) => await stackCommands.renameStack(node)
      ),
      registerCommand(
        'zenml.setActiveStack',
        async (node: StackTreeItem) => await stackCommands.setActiveStack(node)
      ),
      registerCommand(
        'zenml.copyStack',
        async (node: StackTreeItem) => await stackCommands.copyStack(node)
      ),
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
