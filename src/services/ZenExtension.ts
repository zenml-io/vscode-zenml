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
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

import { registerAnalyticsCommands } from '../commands/analytics/registry';
import { registerComponentCommands } from '../commands/components/registry';
import { registerModelCommands } from '../commands/models/registry';
import { registerPipelineCommands } from '../commands/pipelines/registry';
import { registerProjectCommands } from '../commands/projects/registry';
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
import { ANALYTICS_FIRST_ACTIVATED_KEY, ENVIRONMENT_INFO_UPDATED } from '../utils/constants';
import { toggleCommands } from '../utils/global';
import { refreshUIComponents } from '../utils/refresh';
import {
  ComponentDataProvider,
  ModelDataProvider,
  PipelineDataProvider,
  ProjectDataProvider,
  ServerDataProvider,
  StackDataProvider,
} from '../views/activityBar';
import { PanelDataProvider } from '../views/panel/panelView/PanelDataProvider';
import ZenMLStatusBar from '../views/statusBar';
import { AnalyticsService } from './AnalyticsService';
import { EventBus } from './EventBus';
import { LSClient } from './LSClient';

export interface IServerInfo {
  name: string;
  module: string;
}

/**
 * Type guard for providers that have a refresh() method.
 */
function isRefreshable(provider: unknown): provider is { refresh: () => Promise<void> | void } {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'refresh' in provider &&
    typeof (provider as { refresh: unknown }).refresh === 'function'
  );
}

/**
 * Type guard for providers that are visibility-aware (have setViewVisible method).
 */
function isVisibilityAware(
  provider: unknown
): provider is { setViewVisible: (visible: boolean) => void } {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'setViewVisible' in provider &&
    typeof (provider as { setViewVisible: unknown }).setViewVisible === 'function'
  );
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
  // Track which views have been loaded once (for lazy-loading on first visibility)
  private static viewsLoadedOnce = new Set<string>();

  // Note: zenmlEnvironmentView is created separately in extension.ts to avoid duplicate TreeView instances
  private static dataProviders = new Map<string, vscode.TreeDataProvider<vscode.TreeItem>>([
    ['zenmlServerView', ServerDataProvider.getInstance()],
    ['zenmlStackView', StackDataProvider.getInstance()],
    ['zenmlComponentView', ComponentDataProvider.getInstance()],
    ['zenmlPipelineView', PipelineDataProvider.getInstance()],
    ['zenmlProjectView', ProjectDataProvider.getInstance()],
    ['zenmlModelView', ModelDataProvider.getInstance()],
    ['zenmlPanelView', PanelDataProvider.getInstance()],
  ]);

  private static registries = [
    registerServerCommands,
    registerStackCommands,
    registerComponentCommands,
    registerPipelineCommands,
    registerProjectCommands,
    registerModelCommands,
    registerAnalyticsCommands,
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
    this.initializeAnalytics();
    this.subscribeToCoreEvents();
    this.deferredInitialize();
  }

  /**
   * Initializes the analytics service and tracks activation.
   */
  private static initializeAnalytics(): void {
    try {
      const analytics = AnalyticsService.getInstance();
      analytics.initialize(this.context);
      analytics.registerEventBus(EventBus.getInstance());

      // First-run detection: emit extension.first_activated exactly once per install
      const firstActivatedAt = this.context.globalState.get<string>(ANALYTICS_FIRST_ACTIVATED_KEY);
      const isFirstActivation = !firstActivatedAt;

      if (isFirstActivation) {
        const now = new Date().toISOString();
        this.context.globalState.update(ANALYTICS_FIRST_ACTIVATED_KEY, now).then(
          () => {},
          () => {}
        );
        analytics.track('extension.first_activated', { firstActivatedAt: now });
      }

      // Track extension activation (every time)
      analytics.track('extension.activated', {
        extensionVersion: this.context.extension?.packageJSON?.version,
        isFirstActivation,
      });
    } catch {
      // Analytics initialization should never break the extension
      console.debug('[Analytics] Failed to initialize analytics');
    }
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

      // Wire up lazy-loading on visibility change
      const visibilityDisposables = this.attachLazyLoadOnVisibility(viewId, view, provider);
      visibilityDisposables.forEach(d => this.viewDisposables.push(d));
    });
    this.registries.forEach(register => register(this.context));
    await toggleCommands(true);
    this.viewsAndCommandsSetup = true;
  }

  /**
   * Attaches lazy-load behavior to a tree view based on visibility changes.
   * This ensures views that were collapsed at startup load their data when first expanded.
   *
   * @param viewId The ID of the view (for tracking purposes)
   * @param view The TreeView instance
   * @param provider The TreeDataProvider for the view
   * @returns Array of disposables to be cleaned up
   */
  private static attachLazyLoadOnVisibility(
    viewId: string,
    view: vscode.TreeView<vscode.TreeItem>,
    provider: vscode.TreeDataProvider<vscode.TreeItem>
  ): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Handler for visibility changes
    const handleVisibilityChange = async (visible: boolean) => {
      // Notify visibility-aware providers (like ComponentDataProvider)
      // These providers manage their own loading via setViewVisible/maybeAutoLoad
      if (isVisibilityAware(provider)) {
        provider.setViewVisible(visible);
      }

      // Trigger refresh on first visibility for refreshable providers,
      // but skip if the provider is visibility-aware (it manages its own loading)
      if (visible && !this.viewsLoadedOnce.has(viewId)) {
        this.viewsLoadedOnce.add(viewId);

        // Only force refresh for providers that don't manage their own visibility-driven loading
        if (isRefreshable(provider) && !isVisibilityAware(provider)) {
          try {
            console.log(`[${viewId}] First visibility - triggering lazy load`);
            await provider.refresh();
          } catch (error) {
            console.error(`[${viewId}] Failed to refresh on visibility:`, error);
          }
        }
      }
    };

    // Subscribe to visibility changes
    disposables.push(
      view.onDidChangeVisibility(e => {
        void handleVisibilityChange(e.visible);
      })
    );

    // Check initial visibility state (in case view is already visible at startup)
    if (view.visible) {
      void handleVisibilityChange(true);
    }

    return disposables;
  }

  /**
   * Registers command and configuration event handlers to the extension context.
   */
  private static subscribeToCoreEvents(): void {
    this.context.subscriptions.push(
      onDidChangePythonInterpreter(async (interpreterDetails: IInterpreterDetails) => {
        if (this.interpreterCheckInProgress) {
          return;
        }
        this.interpreterCheckInProgress = true;
        try {
          if (interpreterDetails.path) {
            const resolvedEnv = await resolveInterpreter(interpreterDetails.path);
            const { isSupported, message } = isPythonVersionSupported(resolvedEnv);
            if (!isSupported) {
              vscode.window.showErrorMessage(`Interpreter not supported: ${message}`);
              return;
            }

            // Propagate Python version to analytics common properties
            if (resolvedEnv?.version) {
              const v = resolvedEnv.version;
              const pythonVersion = [v.major, v.minor, v.micro]
                .filter(n => n !== undefined)
                .join('.');
              if (pythonVersion) {
                EventBus.getInstance().emit(ENVIRONMENT_INFO_UPDATED, { pythonVersion });
              }
            }

            await runServer();
            if (!this.lsClient.isZenMLReady) {
              console.log('ZenML Client is not initialized yet.');
              // Let Environment view handle the detailed messaging
            } else {
              console.log('🚀 ZenML installation found. Ready to use.');
              await refreshUIComponents();
            }
          }
        } finally {
          this.interpreterCheckInProgress = false;
        }
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
}
