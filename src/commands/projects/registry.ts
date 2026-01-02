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
import { ProjectDataProvider } from '../../views/activityBar/projectView/ProjectDataProvider';
import { ProjectTreeItem } from '../../views/activityBar/projectView/ProjectTreeItems';
import { projectCommands } from './cmds';

/**
 * Registers project-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerProjectCommands = (context: ExtensionContext) => {
  const projectDataProvider = ProjectDataProvider.getInstance();
  try {
    const registeredCommands = [
      registerCommand('zenml.setProjectItemsPerPage', async () =>
        projectDataProvider.updateItemsPerPage()
      ),
      registerCommand('zenml.refreshProjectView', async () => projectCommands.refreshProjectView()),
      registerCommand('zenml.setActiveProject', async (node: ProjectTreeItem) =>
        projectCommands.setActiveProject(node)
      ),
      registerCommand('zenml.goToProjectUrl', (node: ProjectTreeItem) =>
        projectCommands.goToProjectUrl(node)
      ),
      registerCommand('zenml.nextProjectPage', async () => projectDataProvider.goToNextPage()),
      registerCommand('zenml.previousProjectPage', async () =>
        projectDataProvider.goToPreviousPage()
      ),
    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'projectCommandsRegistered', true);
  } catch (error) {
    console.error('Error registering project commands:', error);
    commands.executeCommand('setContext', 'projectCommandsRegistered', false);
  }
};
