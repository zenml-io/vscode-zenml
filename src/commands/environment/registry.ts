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
import { environmentCommands } from './cmds';

/**
 * Registers pipeline-related commands for the extension.
 *
 * @param {ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 */
export const registerEnvironmentCommands = (context: ExtensionContext) => {
  try {
    const registeredCommands = [
      registerCommand(
        'zenml.setPythonInterpreter',
        async () => await environmentCommands.setPythonInterpreter()
      ),
      registerCommand(
        'zenml.refreshEnvironmentView',
        async () => await environmentCommands.refreshEnvironmentView()
      ),
      registerCommand(
        'zenml.restartLspServer',
        async () => await environmentCommands.restartLSPServer()
      ),
    ];

    registeredCommands.forEach(cmd => {
      context.subscriptions.push(cmd);
      ZenExtension.commandDisposables.push(cmd);
    });

    commands.executeCommand('setContext', 'environmentCommandsRegistered', true);
  } catch (error) {
    console.error('Error registering environment commands:', error);
    commands.executeCommand('setContext', 'environmentCommandsRegistered', false);
  }
};
