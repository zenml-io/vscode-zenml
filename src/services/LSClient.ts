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
import { storeActiveStack } from '../commands/stack/utils';
import { GenericLSClientResponse, VersionMismatchError } from '../types/LSClientResponseTypes';
import { LSNotificationIsZenMLInstalled } from '../types/LSNotificationTypes';
import { ConfigUpdateDetails } from '../types/ServerInfoTypes';
import {
  LSCLIENT_READY,
  LSP_IS_ZENML_INSTALLED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_SERVER_CHANGED,
  LSP_ZENML_STACK_CHANGED,
  PYTOOL_MODULE,
  REFRESH_ENVIRONMENT_VIEW,
} from '../utils/constants';
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
      this.client.onNotification(LSP_ZENML_SERVER_CHANGED, this.handleServerChanged.bind(this));
      this.client.onNotification(LSP_ZENML_STACK_CHANGED, this.handleStackChanged.bind(this));
      this.client.onNotification(LSP_IS_ZENML_INSTALLED, this.handleZenMLInstalled.bind(this));
      this.client.onNotification(LSP_ZENML_CLIENT_INITIALIZED, this.handleZenMLReady.bind(this));
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
  public handleZenMLInstalled(params: { is_installed: boolean; version?: string }): void {
    console.log(`Received ${LSP_IS_ZENML_INSTALLED} notification: `, params.is_installed);
    this.localZenML = {
      is_installed: params.is_installed,
      version: params.version || '',
    };
    this.eventBus.emit(LSP_IS_ZENML_INSTALLED, this.localZenML);
    this.eventBus.emit(REFRESH_ENVIRONMENT_VIEW);
  }

  /**
   *  Handles the zenml/ready notification.
   *
   * @param params The ready status of ZenML.
   * @returns A promise resolving to void.
   */
  public async handleZenMLReady(params: { ready: boolean }): Promise<void> {
    console.log(`Received ${LSP_ZENML_CLIENT_INITIALIZED} notification: `, params.ready);
    if (!params.ready) {
      this.eventBus.emit(LSP_ZENML_CLIENT_INITIALIZED, false);
      await commands.executeCommand('zenml.promptForInterpreter');
    } else {
      this.eventBus.emit(LSP_ZENML_CLIENT_INITIALIZED, true);
    }
    this.isZenMLReady = params.ready;
    this.eventBus.emit(REFRESH_ENVIRONMENT_VIEW);
  }

  /**
   * Handles the zenml/serverChanged notification.
   *
   * @param details The details of the server update.
   */
  public async handleServerChanged(details: ConfigUpdateDetails): Promise<void> {
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
  }

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
  public async handleStackChanged(activeStackId: string): Promise<void> {
    console.log(`Received ${LSP_ZENML_STACK_CHANGED} notification:`, activeStackId);
    await storeActiveStack(activeStackId);
    this.eventBus.emit(LSP_ZENML_STACK_CHANGED, activeStackId);
  }

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
      return { error: 'LSClient is not ready yet.' } as T;
    }
    if (!this.isZenMLReady) {
      console.error(`${command}: ZenML Client is not initialized yet.`);
      return { error: 'ZenML Client is not initialized.' } as T;
    }
    try {
      const result = await this.client.sendRequest('workspace/executeCommand', {
        command: `${PYTOOL_MODULE}.${command}`,
        arguments: args,
      });
      return result as T;
    } catch (error: any) {
      const errorMessage = error.message;
      console.error(`Failed to execute command ${command}:`, errorMessage || error);
      if (errorMessage.includes('ValidationError') || errorMessage.includes('RuntimeError')) {
        return this.handleKnownErrors(error);
      }
      return { error: errorMessage } as T;
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
  public updateClient(updatedClient: LanguageClient): void {
    this.client = updatedClient;
    this.setupNotificationListeners();
  }

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
    if (!this.instance) {
      this.instance = new LSClient();
    }
    return this.instance;
  }
}
