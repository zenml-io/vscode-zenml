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
import { pipelineCommands } from './cmds';
import { registerCommand } from '../../common/vscodeapi';
import { ZenExtension } from '../../services/ZenExtension';
import { PipelineDataProvider, PipelineTreeItem } from '../../views/activityBar';
import { ExtensionContext, commands } from 'vscode';

/**
 * Registers pipeline-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerPipelineCommands = (context: ExtensionContext) => {
  const pipelineDataProvider = PipelineDataProvider.getInstance();

  try {
    const registeredCommands = [
      registerCommand(
        'zenml.refreshPipelineView',
        async () => await pipelineCommands.refreshPipelineView()
      ),
      registerCommand(
        'zenml.deletePipelineRun',
        async (node: PipelineTreeItem) => await pipelineCommands.deletePipelineRun(node)
      ),
      registerCommand('zenml.nextPipelineRunsPage', async () => pipelineDataProvider.goToNextPage()),
      registerCommand('zenml.previousPipelineRunsPage', async () => pipelineDataProvider.goToPreviousPage()),
      registerCommand("zenml.setPipelineRunsPerPage", async () => await pipelineDataProvider.updateItemsPerPage()),

    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'pipelineCommandsRegistered', true);
  } catch (error) {
    console.error('Error registering pipeline commands:', error);
    commands.executeCommand('setContext', 'pipelineCommandsRegistered', false);
  }
};
