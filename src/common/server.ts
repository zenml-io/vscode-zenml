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
import * as fsapi from 'fs-extra';
import * as vscode from 'vscode';
import { Disposable, env, l10n, LanguageStatusSeverity, LogOutputChannel } from 'vscode';
import { State } from 'vscode-languageclient';
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
} from 'vscode-languageclient/node';
import { LSClient } from '../services/LSClient';
import { DEBUG_SERVER_SCRIPT_PATH, SERVER_SCRIPT_PATH } from './constants';
import { traceError, traceInfo, traceVerbose } from './log/logging';
import { getDebuggerPath } from './python';
import {
  getExtensionSettings,
  getGlobalSettings,
  getWorkspaceSettings,
  ISettings,
} from './settings';
import { updateStatus } from './status';
import { getLSClientTraceLevel, getProjectRoot } from './utilities';
import { isVirtualWorkspace } from './vscodeapi';
import { ZenExtension } from '../services/ZenExtension';
import { EventBus } from '../services/EventBus';
import { LSCLIENT_STATE_CHANGED } from '../utils/constants';

export type IInitOptions = { settings: ISettings[]; globalSettings: ISettings };

async function createServer(
  settings: ISettings,
  serverId: string,
  serverName: string,
  outputChannel: LogOutputChannel,
  initializationOptions: IInitOptions
): Promise<LanguageClient> {
  const command = settings.interpreter[0];
  // console.log('command is', command);

  const cwd = settings.cwd;

  // Set debugger path needed for debugging python code.
  const newEnv = { ...process.env };
  const debuggerPath = await getDebuggerPath();
  const isDebugScript = await fsapi.pathExists(DEBUG_SERVER_SCRIPT_PATH);
  if (newEnv.USE_DEBUGPY && debuggerPath) {
    newEnv.DEBUGPY_PATH = debuggerPath;
  } else {
    newEnv.USE_DEBUGPY = 'False';
  }

  // Set import strategy
  newEnv.LS_IMPORT_STRATEGY = settings.importStrategy;

  // Set notification type
  newEnv.LS_SHOW_NOTIFICATION = settings.showNotifications;

  const args =
    newEnv.USE_DEBUGPY === 'False' || !isDebugScript
      ? settings.interpreter.slice(1).concat([SERVER_SCRIPT_PATH])
      : settings.interpreter.slice(1).concat([DEBUG_SERVER_SCRIPT_PATH]);
  traceInfo(`Server run command: ${[command, ...args].join(' ')}`);

  const serverOptions: ServerOptions = {
    command,
    args,
    options: { cwd, env: newEnv },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for python documents
    documentSelector: isVirtualWorkspace()
      ? [{ language: 'python' }]
      : [
        { scheme: 'file', language: 'python' },
        { scheme: 'untitled', language: 'python' },
        { scheme: 'vscode-notebook', language: 'python' },
        { scheme: 'vscode-notebook-cell', language: 'python' },
      ],
    outputChannel: outputChannel,
    traceOutputChannel: outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    initializationOptions: {
      ...initializationOptions,
      interpreter: settings.interpreter[0],
    },
  };

  return new LanguageClient(serverId, serverName, serverOptions, clientOptions);
}

let _disposables: Disposable[] = [];
export async function restartServer(workspaceSetting: ISettings,): Promise<LanguageClient | undefined> {
  const lsClientInstance = LSClient.getInstance();
  const lsClient = lsClientInstance.getLanguageClient();
  if (lsClient) {
    traceInfo(`Server: Stop requested`);
    await lsClient.stop();
    _disposables.forEach(d => d.dispose());
    _disposables = [];
  }
  updateStatus(undefined, LanguageStatusSeverity.Information, true);

  const newLSClient = await createServer(workspaceSetting, ZenExtension.serverId, ZenExtension.serverName, ZenExtension.outputChannel, {
    settings: await getExtensionSettings(ZenExtension.serverId, true),
    globalSettings: await getGlobalSettings(ZenExtension.serverId, true),
  });

  lsClientInstance.updateClient(newLSClient);

  traceInfo(`Server: Start requested.`);
  _disposables.push(
    newLSClient.onDidChangeState(e => {
      EventBus.getInstance().emit(LSCLIENT_STATE_CHANGED, e.newState)
      switch (e.newState) {
        case State.Stopped:
          traceVerbose(`Server State: Stopped`);
          break;
        case State.Starting:
          traceVerbose(`Server State: Starting`);
          break;
        case State.Running:
          traceVerbose(`Server State: Running`);
          updateStatus(undefined, LanguageStatusSeverity.Information, false);
          break;
      }
    })
  );
  try {
    await ZenExtension.lsClient.startLanguageClient();
  } catch (ex) {
    updateStatus(l10n.t('Server failed to start.'), LanguageStatusSeverity.Error);
    traceError(`Server: Start failed: ${ex}`);
  }
  await newLSClient.setTrace(getLSClientTraceLevel(ZenExtension.outputChannel.logLevel, env.logLevel));
  return newLSClient;
}

export async function runServer() {
  const projectRoot = await getProjectRoot();
  const workspaceSetting = await getWorkspaceSettings(ZenExtension.serverId, projectRoot, true);
  if (workspaceSetting.interpreter.length === 0) {
    updateStatus(
      vscode.l10n.t('Please select a Python interpreter.'),
      vscode.LanguageStatusSeverity.Error
    );
    traceError('Python interpreter missing. Please use Python 3.8 or greater.');
    return;
  }

  await restartServer(workspaceSetting);
}
