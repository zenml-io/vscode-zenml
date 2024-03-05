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
// extension.ts
import * as vscode from 'vscode';
import ZenMLStatusBar from './views/statusBar';
import { ServerDataProvider, StackDataProvider } from './views/activityBar';
import { registerServerCommands } from './commands/server/registry';
import { registerStackCommands } from './commands/stack/registry';
import { promptAndStoreServerUrl, initiateDeviceAuthorization } from './commands/server/utils';
import { ZenMLClient } from './services/ZenMLClient';
import { PipelineDataProvider } from './views/activityBar/pipelineView/PipelineDataProvider';
import { registerPipelineCommands } from './commands/pipelines/registry';
import { getActiveStack } from './commands/stack/utils';

export async function activate(context: vscode.ExtensionContext) {
  const zenmlClient = ZenMLClient.getInstance();
  let serverUrl = zenmlClient.getZenMLServerUrl();
  let accessToken = zenmlClient.getZenMLAccessToken();

  if (!serverUrl) {
    await promptAndStoreServerUrl();
  }

  if (!accessToken) {
    await initiateDeviceAuthorization();
    accessToken = zenmlClient.getZenMLAccessToken();
  }

  serverUrl = zenmlClient.getZenMLServerUrl();
  if (serverUrl && !accessToken) {
    await initiateDeviceAuthorization();
    accessToken = zenmlClient.getZenMLAccessToken();
  }

  const statusBar = ZenMLStatusBar.getInstance(context);
  const serverDataProvider = new ServerDataProvider();
  const stackDataProvider = new StackDataProvider(context);
  const pipelineDataProvider = new PipelineDataProvider();

  vscode.window.createTreeView('zenmlServerView', {
    treeDataProvider: serverDataProvider,
  });
  vscode.window.createTreeView('zenmlStackView', {
    treeDataProvider: stackDataProvider,
  });
  vscode.window.createTreeView('zenmlPipelineView', {
    treeDataProvider: pipelineDataProvider,
  });

  registerServerCommands(context, serverDataProvider, stackDataProvider, pipelineDataProvider);
  registerStackCommands(context, stackDataProvider, statusBar);
  registerPipelineCommands(context, pipelineDataProvider);

  await getActiveStack();

  console.log('ZenML extension is now active!');
}

export function deactivate() { }
