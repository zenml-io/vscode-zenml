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
import { componentCommands } from './cmds';
import { registerCommand } from '../../common/vscodeapi';
import { ZenExtension } from '../../services/ZenExtension';
import { ExtensionContext, commands } from 'vscode';
import { ComponentDataProvider } from '../../views/activityBar/componentView/ComponentDataProvider';
import { StackComponentTreeItem } from '../../views/activityBar';

/**
 * Registers stack component-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerComponentCommands = (context: ExtensionContext) => {
  const componentDataProvider = ComponentDataProvider.getInstance();
  try {
    const registeredCommands = [
      registerCommand(
        'zenml.setComponentItemsPerPage',
        async () => await componentDataProvider.updateItemsPerPage()
      ),
      registerCommand(
        'zenml.refreshComponentView',
        async () => await componentCommands.refreshComponentView()
      ),
      registerCommand(
        'zenml.createComponent',
        async () => await componentCommands.createComponent()
      ),
      registerCommand(
        'zenml.updateComponent',
        async (node: StackComponentTreeItem) => await componentCommands.updateComponent(node)
      ),
      registerCommand(
        'zenml.nextComponentPage',
        async () => await componentDataProvider.goToNextPage()
      ),
      registerCommand(
        'zenml.previousComponentPage',
        async () => await componentDataProvider.goToPreviousPage()
      ),
    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'componentCommandsRegistered', true);
  } catch (e) {
    console.error('Error registering component commands:', e);
    commands.executeCommand('setContext', 'componentCommandsRegistered', false);
  }
};
