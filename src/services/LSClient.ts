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
import { ProgressLocation, commands, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { storeActiveProject } from '../commands/projects/utils';
import { storeActiveStackId } from '../commands/stack/utils';
import { GenericLSClientResponse, VersionMismatchError } from '../types/LSClientResponseTypes';
import { LSNotificationIsZenMLInstalled } from '../types/LSNotificationTypes';
import { ConfigUpdateDetails } from '../types/ServerInfoTypes';
import {
  ANALYTICS_TRACK,
  ENVIRONMENT_INFO_UPDATED,
  LSCLIENT_READY,
  LSP_IS_ZENML_INSTALLED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
  LSP_ZENML_SERVER_CHANGED,
  LSP_ZENML_STACK_CHANGED,
  PYTOOL_MODULE,
  REFRESH_ENVIRONMENT_VIEW,
} from '../utils/constants';
import { isErrorLikeResponse, sanitizeErrorForAnalytics } from '../utils/analytics';
import { getZenMLServerUrl, updateServerUrlAndToken } from '../utils/global';
import { debounce } from '../utils/refresh';
import { EventBus } from './EventBus';

export class LSClient {
  private static instance: LSClient | null = null;
  private client: LanguageClient | null = null;
  private eventBus: EventBus = EventBus.getInstance();
  public clientReady: boolean = false;
  public isZenMLReady = false;
  public localZenML: LSNotificationIsZenMLInstalled = {
    is_installed: false,
    version: '',
  };

  // Error analytics dedupe state
  private errorDedupe = new Map<string, number>();
  private readonly ERROR_DEDUPE_WINDOW_MS = 60_000;
  private emittedNotReadyThisSession = false;
  private lastDedupePruneAt = 0;

  public restartLSPServerDebounced = debounce(async () => {
    await commands.executeCommand(`${PYTOOL_MODULE}.restart`);
    // await refreshUIComponents();
  }, 500);

  /**
   * Sets up notification listeners for the language client.
   *
   * @returns void
   */
  public setupNotificationListeners(): void {
    if (this.client) {
      this.client.onNotification(LSP_ZENML_SERVER_CHANGED, this.handleServerChanged);
      this.client.onNotification(LSP_ZENML_STACK_CHANGED, this.handleStackChanged);
      this.client.onNotification(LSP_ZENML_PROJECT_CHANGED, this.handleProjectChanged);
      this.client.onNotification(LSP_IS_ZENML_INSTALLED, this.handleZenMLInstalled);
      this.client.onNotification(LSP_ZENML_CLIENT_INITIALIZED, this.handleZenMLReady);
    }
  }

  /**
   * Starts the language client.
   *
   * @returns A promise resolving to void.
   */
  public async startLanguageClient(): Promise<void> {
    try {
      if (this.client) {
        await this.client.start();
        this.clientReady = true;
        this.eventBus.emit(LSCLIENT_READY, true);
        console.log('Language client started successfully.');
      }
    } catch (error) {
      console.error('Failed to start the language client:', error);
    }
  }

  /**
   * Handles the zenml/isInstalled notification.
   *
   * @param params The installation status of ZenML.
   */
  public handleZenMLInstalled = (params: { is_installed: boolean; version?: string }): void => {
    console.log(`Received ${LSP_IS_ZENML_INSTALLED} notification: `, params.is_installed);
    this.localZenML = {
      is_installed: params.is_installed,
      version: params.version || '',
    };
    this.eventBus.emit(LSP_IS_ZENML_INSTALLED, this.localZenML);
    this.eventBus.emit(REFRESH_ENVIRONMENT_VIEW);

    // Propagate ZenML version info to analytics common properties
    this.eventBus.emit(ENVIRONMENT_INFO_UPDATED, {
      zenmlInstalled: params.is_installed,
      zenmlVersion: params.version || '',
    });
  };

  /**
   *  Handles the zenml/ready notification.
   *
   * @param params The ready status of ZenML.
   * @returns A promise resolving to void.
   */
  public handleZenMLReady = async (params: { ready: boolean }): Promise<void> => {
    console.log(`Received ${LSP_ZENML_CLIENT_INITIALIZED} notification: `, params.ready);
    if (!params.ready) {
      this.eventBus.emit(LSP_ZENML_CLIENT_INITIALIZED, false);
    } else {
      this.eventBus.emit(LSP_ZENML_CLIENT_INITIALIZED, true);
    }
    this.isZenMLReady = params.ready;
    this.eventBus.emit(REFRESH_ENVIRONMENT_VIEW);
  };

  /**
   * Handles the zenml/serverChanged notification.
   *
   * @param details The details of the server update.
   */
  public handleServerChanged = async (details: ConfigUpdateDetails): Promise<void> => {
    if (this.isZenMLReady) {
      console.log(`Received ${LSP_ZENML_SERVER_CHANGED} notification`);

      const currentServerUrl = getZenMLServerUrl();
      const { url, api_token } = details;
      if (currentServerUrl !== url) {
        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: 'ZenML config change detected',
            cancellable: false,
          },
          async () => {
            await this.stopLanguageClient();
            await updateServerUrlAndToken(url, api_token);
            this.restartLSPServerDebounced();
          }
        );
      }
    }
  };

  /**
   * Stops the language client.
   *
   * @returns A promise resolving to void.
   */
  public async stopLanguageClient(): Promise<void> {
    this.clientReady = false;
    try {
      if (this.client) {
        await this.client.stop();
        this.eventBus.emit(LSCLIENT_READY, false);
        console.log('Language client stopped successfully.');
      }
    } catch (error) {
      console.error('Failed to stop the language client:', error);
    }
  }

  /**
   * Handles the zenml/stackChanged notification.
   *
   * @param activeStackId The ID of the active stack.
   * @returns A promise resolving to void.
   */
  public handleStackChanged = async (activeStackId: string): Promise<void> => {
    console.log(`Received ${LSP_ZENML_STACK_CHANGED} notification:`, activeStackId);
    await storeActiveStackId(activeStackId);
    this.eventBus.emit(LSP_ZENML_STACK_CHANGED, activeStackId);
  };

  /**
   * Handles the zenml/projectChanged notification.
   *
   * @param projectName The name of the active project.
   * @returns A promise resolving to void.
   */
  public handleProjectChanged = async (projectName: string): Promise<void> => {
    console.log(`Received ${LSP_ZENML_PROJECT_CHANGED} notification:`, projectName);
    await storeActiveProject(projectName);
    this.eventBus.emit(LSP_ZENML_PROJECT_CHANGED, projectName);
  };

  /**
   * Sends a request to the language server.
   *
   * @param {string} command The command to send to the language server.
   * @param {any[]} [args] The arguments to send with the command.
   * @returns {Promise<T>} A promise resolving to the response from the language server.
   */
  public async sendLsClientRequest<T = GenericLSClientResponse>(
    command: string,
    args?: any[]
  ): Promise<T> {
    if (!this.client || !this.clientReady) {
      console.error(`${command}: LSClient is not ready yet.`);
      this.emitErrorOccurred(command, 'preflight', 'LSClient is not ready');
      return { error: 'LSClient is not ready yet.' } as T;
    }
    try {
      const result = await this.client.sendRequest('workspace/executeCommand', {
        command: `${PYTOOL_MODULE}.${command}`,
        arguments: args,
      });

      // Track error responses from the Python backend
      if (isErrorLikeResponse(result)) {
        this.emitErrorOccurred(command, 'response', result.error);
      }

      return result as T;
    } catch (error: any) {
      const errorMessage = error.message;
      console.error(`Failed to execute command ${command}:`, errorMessage || error);
      this.emitErrorOccurred(command, 'request', error);
      if (errorMessage.includes('ValidationError') || errorMessage.includes('RuntimeError')) {
        return this.handleKnownErrors(error);
      }
      return { error: errorMessage } as T;
    }
  }

  /**
   * Emit a privacy-safe error.occurred analytics event with dedupe.
   */
  private emitErrorOccurred(
    operation: string,
    phase: 'preflight' | 'request' | 'response',
    err: unknown
  ): void {
    try {
      // Hard-dedupe lsp_not_ready to once per session
      if (phase === 'preflight') {
        if (this.emittedNotReadyThisSession) {
          return;
        }
        this.emittedNotReadyThisSession = true;
      }

      const sanitized = sanitizeErrorForAnalytics(err, {
        operation,
        phase,
        isResponseError: phase === 'response',
      });

      // Dedupe identical errors within the window
      const dedupeKey = `${operation}:${phase}:${sanitized.errorKind}:${sanitized.messageHash}`;
      const now = Date.now();

      // Opportunistic prune: remove stale entries at most once per window interval
      if (now - this.lastDedupePruneAt >= this.ERROR_DEDUPE_WINDOW_MS) {
        this.lastDedupePruneAt = now;
        for (const [key, ts] of this.errorDedupe) {
          if (now - ts > this.ERROR_DEDUPE_WINDOW_MS) {
            this.errorDedupe.delete(key);
          }
        }
      }
      const lastEmitted = this.errorDedupe.get(dedupeKey);
      if (lastEmitted && now - lastEmitted < this.ERROR_DEDUPE_WINDOW_MS) {
        return;
      }
      this.errorDedupe.set(dedupeKey, now);

      this.eventBus.emit(ANALYTICS_TRACK, {
        event: 'error.occurred',
        properties: {
          operation,
          phase,
          ...sanitized,
        },
      });
    } catch {
      // Best effort — never break the LSP flow for analytics
    }
  }

  private handleKnownErrors<T = VersionMismatchError>(error: any): T {
    let errorType = 'Error';
    let serverVersion = 'N/A';
    let newErrorMessage = '';
    const errorMessage = error.message;
    const versionRegex = /\b\d+\.\d+\.\d+\b/;

    if (errorMessage.includes('ValidationError')) {
      errorType = 'ValidationError';
    } else if (errorMessage.includes('RuntimeError')) {
      errorType = 'RuntimeError';
      if (errorMessage.includes('revision identified by')) {
        const matches = errorMessage.match(versionRegex);
        if (matches) {
          serverVersion = matches[0];
          newErrorMessage = `Can't locate revision identified by ${serverVersion}`;
        }
      }
    }

    return {
      error: errorType,
      message: newErrorMessage || errorMessage,
      clientVersion: this.localZenML.version || 'N/A',
      serverVersion,
    } as T;
  }

  /**
   * Updates the language client.
   *
   * @param {LanguageClient} updatedClient The new language client.
   */
  public updateClient = (updatedClient: LanguageClient): void => {
    this.client = updatedClient;
    this.setupNotificationListeners();
  };

  /**
   * Gets the language client.
   *
   * @returns {LanguageClient | null} The language client.
   */
  public getLanguageClient(): LanguageClient | null {
    return this.client;
  }

  /**
   * Retrieves the singleton instance of LSClient.
   *
   * @returns {LSClient} The singleton instance.
   */
  public static getInstance(): LSClient {
    if (!LSClient.instance) {
      LSClient.instance = new LSClient();
    }
    return LSClient.instance;
  }
}
