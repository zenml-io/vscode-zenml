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
import {
  PipelineDataProvider,
  ServerDataProvider,
  StackDataProvider,
} from '../../views/activityBar';
import { connectServer, disconnectServer, refreshServerStatus } from './cmds';

/**
 * Registers server-related commands for the extension.
 *
 * @param {vscode.ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 * @param {ServerDataProvider} serverDataProvider - An instance of ServerDataProvider that manages the data and updates the view for server-related operations.
 * @param {StackDataProvider} stackDataProvider - An instance of StackDataProvider that manages the data and updates the view for stack-related operations.
 * @param {PipelineDataProvider} pipelineDataProvider - An instance of PipelineDataProvider that manages the data and updates the view for pipeline-related operations.
 */
export function registerServerCommands(
  context: vscode.ExtensionContext,
  serverDataProvider: ServerDataProvider,
  stackDataProvider: StackDataProvider,
  pipelineDataProvider: PipelineDataProvider
) {
  const connectServerCommand = vscode.commands.registerCommand('zenml.connectServer', () =>
    connectServer(serverDataProvider, stackDataProvider, pipelineDataProvider)
  );

  const disconnectServerCommand = vscode.commands.registerCommand('zenml.disconnectServer', () =>
    disconnectServer(serverDataProvider, stackDataProvider, pipelineDataProvider)
  );

  const refreshServerStatusCommand = vscode.commands.registerCommand(
    'zenml.refreshServerStatus',
    () => refreshServerStatus(serverDataProvider)
  );

  context.subscriptions.push(
    connectServerCommand,
    disconnectServerCommand,
    refreshServerStatusCommand
  );
}
