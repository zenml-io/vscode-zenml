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
import { DeploymentDataProvider } from '../../views/activityBar/deploymentView/DeploymentDataProvider';
import { DeploymentTreeItem } from '../../views/activityBar/deploymentView/DeploymentTreeItems';
import { deploymentCommands } from './cmds';

/**
 * Registers deployment-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerDeploymentCommands = (context: ExtensionContext) => {
  const deploymentDataProvider = DeploymentDataProvider.getInstance();

  try {
    const registeredCommands = [
      registerCommand('zenml.refreshDeploymentsView', async () =>
        deploymentCommands.refreshDeploymentView()
      ),
      registerCommand('zenml.provisionDeployment', async (node: DeploymentTreeItem) =>
        deploymentCommands.provisionDeployment(node)
      ),
      registerCommand('zenml.deprovisionDeployment', async (node: DeploymentTreeItem) =>
        deploymentCommands.deprovisionDeployment(node)
      ),
      registerCommand('zenml.deleteDeployment', async (node: DeploymentTreeItem) =>
        deploymentCommands.deleteDeployment(node)
      ),
      registerCommand('zenml.refreshDeploymentStatus', async (node: DeploymentTreeItem) =>
        deploymentCommands.refreshDeploymentStatus(node)
      ),
      registerCommand('zenml.copyDeploymentUrl', async (node: DeploymentTreeItem) =>
        deploymentCommands.copyDeploymentUrl(node)
      ),
      registerCommand('zenml.openDeploymentUrl', async (node: DeploymentTreeItem) =>
        deploymentCommands.openDeploymentUrl(node)
      ),
      registerCommand('zenml.viewDeploymentLogs', async (node: DeploymentTreeItem) =>
        deploymentCommands.viewDeploymentLogs(node)
      ),
      registerCommand('zenml.invokeDeployment', async (node: DeploymentTreeItem) =>
        deploymentCommands.invokeDeployment(node)
      ),
      registerCommand('zenml.nextDeploymentsPage', async () =>
        deploymentDataProvider.goToNextPage()
      ),
      registerCommand('zenml.previousDeploymentsPage', async () =>
        deploymentDataProvider.goToPreviousPage()
      ),
      registerCommand('zenml.setDeploymentsPerPage', async () =>
        deploymentDataProvider.updateItemsPerPage()
      ),
    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'deploymentCommandsRegistered', true);
  } catch (error) {
    console.error('Error registering deployment commands:', error);
    commands.executeCommand('setContext', 'deploymentCommandsRegistered', false);
  }
};
