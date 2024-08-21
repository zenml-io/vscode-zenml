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
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

import { registerPipelineCommands } from '../commands/pipelines/registry';
import { registerServerCommands } from '../commands/server/registry';
import { registerStackCommands } from '../commands/stack/registry';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { registerLogger, traceLog, traceVerbose } from '../common/log/logging';
import {
  IInterpreterDetails,
  initializePython,
  isPythonVersionSupported,
  onDidChangePythonInterpreter,
  resolveInterpreter,
} from '../common/python';
import { runServer } from '../common/server';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from '../common/settings';
import { registerLanguageStatusItem } from '../common/status';
import { getLSClientTraceLevel } from '../common/utilities';
import {
  createOutputChannel,
  onDidChangeConfiguration,
  registerCommand,
} from '../common/vscodeapi';
import { refreshUIComponents } from '../utils/refresh';
import { PipelineDataProvider, ServerDataProvider, StackDataProvider } from '../views/activityBar';
import ZenMLStatusBar from '../views/statusBar';
import { LSClient } from './LSClient';
import { toggleCommands } from '../utils/global';
import { PanelDataProvider } from '../views/panel/panelView/PanelDataProvider';
import { ComponentDataProvider } from '../views/activityBar/componentView/ComponentDataProvider';
import { registerComponentCommands } from '../commands/components/registry';

export interface IServerInfo {
  name: string;
  module: string;
}

export class ZenExtension {
  private static context: vscode.ExtensionContext;
  static commandDisposables: vscode.Disposable[] = [];
  static viewDisposables: vscode.Disposable[] = [];
  public static lsClient: LSClient;
  public static outputChannel: vscode.LogOutputChannel;
  public static serverId: string;
  public static serverName: string;
  private static viewsAndCommandsSetup = false;
  public static interpreterCheckInProgress = false;

  private static dataProviders = new Map<string, vscode.TreeDataProvider<vscode.TreeItem>>([
    ['zenmlServerView', ServerDataProvider.getInstance()],
    ['zenmlStackView', StackDataProvider.getInstance()],
    ['zenmlComponentView', ComponentDataProvider.getInstance()],
    ['zenmlPipelineView', PipelineDataProvider.getInstance()],
    ['zenmlPanelView', PanelDataProvider.getInstance()],
  ]);

  private static registries = [
    registerServerCommands,
    registerStackCommands,
    registerComponentCommands,
    registerPipelineCommands,
  ];

  /**
   * Initializes the extension services and saves the context for reuse.
   *
   * @param context The extension context provided by VS Code on activation.
   */
  static async activate(context: vscode.ExtensionContext, lsClient: LSClient): Promise<void> {
    this.context = context;
    this.lsClient = lsClient;
    const serverDefaults = this.loadServerDefaults();
    this.serverName = serverDefaults.name;
    this.serverId = serverDefaults.module;

    this.setupLoggingAndTrace();
    this.subscribeToCoreEvents();
    this.deferredInitialize();
  }

  /**
   * Deferred initialization tasks to be run after initializing other tasks.
   */
  static deferredInitialize(): void {
    setImmediate(async () => {
      const interpreter = getInterpreterFromSetting(this.serverId);
      if (interpreter === undefined || interpreter.length === 0) {
        traceLog(`Python extension loading`);
        await initializePython(this.context.subscriptions);
        traceLog(`Python extension loaded`);
      } else {
        await runServer();
      }
      await this.setupViewsAndCommands();
    });
  }

  /**
   * Sets up the views and commands for the ZenML extension.
   */
  static async setupViewsAndCommands(): Promise<void> {
    if (this.viewsAndCommandsSetup) {
      console.log('Views and commands have already been set up. Refreshing views...');
      await toggleCommands(true);
      return;
    }

    const zenmlStatusBar = ZenMLStatusBar.getInstance();
    zenmlStatusBar.registerCommands();

    this.dataProviders.forEach((provider, viewId) => {
      const view = vscode.window.createTreeView(viewId, { treeDataProvider: provider });
      this.viewDisposables.push(view);
    });
    this.registries.forEach(register => register(this.context));
    await toggleCommands(true);
    this.viewsAndCommandsSetup = true;
  }

  /**
   * Registers command and configuration event handlers to the extension context.
   */
  private static subscribeToCoreEvents(): void {
    this.context.subscriptions.push(
      onDidChangePythonInterpreter(async (interpreterDetails: IInterpreterDetails) => {
        this.interpreterCheckInProgress = true;
        if (interpreterDetails.path) {
          const resolvedEnv = await resolveInterpreter(interpreterDetails.path);
          const { isSupported, message } = isPythonVersionSupported(resolvedEnv);
          if (!isSupported) {
            vscode.window.showErrorMessage(`Interpreter not supported: ${message}`);
            this.interpreterCheckInProgress = false;
            return;
          }
          await runServer();
          if (!this.lsClient.isZenMLReady) {
            console.log('ZenML Client is not initialized yet.');
            await this.promptForPythonInterpreter();
          } else {
            vscode.window.showInformationMessage('🚀 ZenML installation found. Ready to use.');
            await refreshUIComponents();
          }
        }
        this.interpreterCheckInProgress = false;
      }),
      registerCommand(`${this.serverId}.showLogs`, async () => {
        this.outputChannel.show();
      }),
      onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
        if (checkIfConfigurationChanged(e, this.serverId)) {
          console.log('Configuration changed, restarting LSP server...', e);
          await runServer();
        }
      }),
      registerCommand(`${this.serverId}.restart`, async () => {
        await runServer();
      }),
      registerCommand(`zenml.promptForInterpreter`, async () => {
        if (!this.interpreterCheckInProgress && !this.lsClient.isZenMLReady) {
          await this.promptForPythonInterpreter();
        }
      }),
      registerLanguageStatusItem(this.serverId, this.serverName, `${this.serverId}.showLogs`)
    );
  }

  /**
   * Prompts the user to select a Python interpreter.
   *
   * @returns {Promise<void>} A promise that resolves to void.
   */
  static async promptForPythonInterpreter(): Promise<void> {
    if (this.interpreterCheckInProgress) {
      console.log('Interpreter check already in progress. Skipping prompt.');
      return;
    }
    if (this.lsClient.isZenMLReady) {
      console.log('ZenML is already installed, no need to prompt for interpreter.');
      return;
    }
    try {
      const selected = await vscode.window.showInformationMessage(
        'ZenML not found with the current Python interpreter. Would you like to select a different interpreter?',
        'Select Interpreter',
        'Cancel'
      );
      if (selected === 'Select Interpreter') {
        await vscode.commands.executeCommand('python.setInterpreter');
        console.log('Interpreter selection completed.');
      } else {
        console.log('Interpreter selection cancelled.');
      }
    } catch (err) {
      console.error('Error selecting Python interpreter:', err);
    }
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
}
