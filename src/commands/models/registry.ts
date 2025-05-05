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
import { ModelDataProvider } from '../../views/activityBar/modelView/ModelDataProvider';
import { modelCommands } from './cmds';

/**
 * Registers model commands with VS Code.
 *
 * @param {ExtensionContext} context - The extension context.
 */
export function registerModelCommands(context: ExtensionContext): void {
  const modelDataProvider = ModelDataProvider.getInstance();

  try {
    const registeredCommands = [
      registerCommand('zenml.refreshModelView', async () => modelCommands.refreshModelView()),
      registerCommand('zenml.setModelsPerPage', async () => modelDataProvider.updateItemsPerPage()),
      registerCommand('zenml.nextModelPage', async () => modelDataProvider.goToNextPage()),
      registerCommand('zenml.previousModelPage', async () => modelDataProvider.goToPreviousPage()),
    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'modelCommandsRegistered', true);
  } catch (error) {
    console.error('Error registering model commands:', error);
    commands.executeCommand('setContext', 'modelCommandsRegistered', false);
  }
}
