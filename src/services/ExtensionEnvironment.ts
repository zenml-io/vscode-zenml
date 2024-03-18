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
import * as path from 'path';
import * as fs from 'fs-extra';
import ZenMLStatusBar from '../views/statusBar';
import { PipelineDataProvider, ServerDataProvider, StackDataProvider } from '../views/activityBar';
import { registerServerCommands } from '../commands/server/registry';
import { registerStackCommands } from '../commands/stack/registry';
import { registerPipelineCommands } from '../commands/pipelines/registry';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { registerLogger, traceLog, traceVerbose } from '../common/log/logging';
import { initializePython, onDidChangePythonInterpreter } from '../common/python';
import {
  createOutputChannel,
  onDidChangeConfiguration,
  registerCommand,
} from '../common/vscodeapi';
import { getLSClientTraceLevel } from '../common/utilities';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from '../common/settings';
import { registerLanguageStatusItem } from '../common/status';
import { runServer } from '../common/server';
import { LSClient } from './LSClient';

export interface IServerInfo {
  name: string;
  module: string;
}

export class ExtensionEnvironment {
  private static context: vscode.ExtensionContext;
  static commandDisposables: vscode.Disposable[] = [];
  static viewDisposables: vscode.Disposable[] = [];

  private static outputChannel: vscode.LogOutputChannel;
  private static serverId: string;
  private static serverName: string;

  private static dataProviders = new Map<string, vscode.TreeDataProvider<vscode.TreeItem>>([
    ['zenmlServerView', ServerDataProvider.getInstance()],
    ['zenmlStackView', StackDataProvider.getInstance()],
    ['zenmlPipelineView', PipelineDataProvider.getInstance()],
  ]);

  private static registries = [
    registerServerCommands,
    registerStackCommands,
    registerPipelineCommands,
  ];

  /**
   * Initializes the extension services and saves the context for reuse.
   *
   * @param context The extension context provided by VS Code on activation.
   */
  static initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    const serverDefaults = this.loadServerDefaults();
    this.serverName = serverDefaults.name;
    this.serverId = serverDefaults.module;

    this.setupLoggingAndTrace();
    this.subscribeToCoreEvents();
  }

  /**
   * Deferred initialization tasks to be run after initializing other tasks.
   */
  static deferredInitialize(): void {
    setImmediate(async () => {
      const interpreter = getInterpreterFromSetting(this.serverId);
      if (!interpreter) {
        traceLog(`Python extension loading`);
        await initializePython(this.context.subscriptions);
        traceLog(`Python extension loaded`);
      } else {
        await runServer(this.serverId, this.serverName, this.outputChannel);
      }
      this.setupViewsAndCommands();
    });
  }

  /**
   * Sets up the views and commands for the ZenML extension.
   */
  private static setupViewsAndCommands(): void {
    ZenMLStatusBar.getInstance();
    this.dataProviders.forEach((provider, viewId) => {
      const view = vscode.window.createTreeView(viewId, { treeDataProvider: provider });
      this.viewDisposables.push(view);
    });
    this.registries.forEach(register => register(this.context));
  }

  /**
   * Registers command and configuration event handlers to the extension context.
   */
  private static subscribeToCoreEvents(): void {
    this.context.subscriptions.push(
      onDidChangePythonInterpreter(async () => {
        await runServer(this.serverId, this.serverName, this.outputChannel);
      }),
      registerCommand(`${this.serverId}.showLogs`, async () => {
        this.outputChannel.show();
      }),
      onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
        if (checkIfConfigurationChanged(e, this.serverId)) {
          await runServer(this.serverId, this.serverName, this.outputChannel);
        }
      }),
      registerCommand(`${this.serverId}.restart`, async () => {
        await runServer(this.serverId, this.serverName, this.outputChannel);
      }),
      registerLanguageStatusItem(this.serverId, this.serverName, `${this.serverId}.showLogs`)
    );
  }

  /**
   * Initializes the outputChannel and logging for the ZenML extension.
   */
  private static setupLoggingAndTrace(): void {
    this.outputChannel = createOutputChannel(this.serverName);

    this.context.subscriptions.push(this.outputChannel, registerLogger(this.outputChannel));
    const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
      const level = getLSClientTraceLevel(c, g);
      const lsClient = LSClient.getInstance().getLanguageClient();
      await lsClient?.setTrace(level);
    };

    this.context.subscriptions.push(
      this.outputChannel.onDidChangeLogLevel(
        async e => await changeLogLevel(e, vscode.env.logLevel)
      ),
      vscode.env.onDidChangeLogLevel(
        async e => await changeLogLevel(this.outputChannel.logLevel, e)
      )
    );

    traceLog(`Name: ${this.serverName}`);
    traceLog(`Module: ${this.serverId}`);
    traceVerbose(
      `Full Server Info: ${JSON.stringify({ name: this.serverName, module: this.serverId })}`
    );
  }

  /**
   * Loads the server defaults from the package.json file.
   *
   * @returns {IServerInfo} The server defaults.
   */
  private static loadServerDefaults(): IServerInfo {
    const packageJson = path.join(EXTENSION_ROOT_DIR, 'package.json');
    const content = fs.readFileSync(packageJson).toString();
    const config = JSON.parse(content);
    return config.serverInfo as IServerInfo;
  }

  /**
   * Deactivates ZenML features when requirements not met.
   * 
   * @returns {Promise<void>} A promise that resolves to void.
   */
  static async deactivateFeatures(): Promise<void> {
    this.commandDisposables.forEach(disposable => disposable.dispose());
    this.commandDisposables = [];

    this.viewDisposables.forEach(disposable => disposable.dispose());
    this.viewDisposables = [];
    console.log('Features deactivated due to unmet requirements.');
  }

  static registerRestartServer() {
    this.context.subscriptions.push(vscode.commands.registerCommand('zenml.restartServer', async () => {
      await runServer(this.serverId, this.serverName, this.outputChannel);
    }));
  };
}
