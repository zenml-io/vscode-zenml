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
import { ProgressLocation, commands, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { storeActiveStack } from '../commands/stack/utils';
import { GenericLSClientResponse } from '../types/LSClientResponseTypes';
import { ConfigUpdateDetails } from '../types/ServerInfoTypes';
import { PYTOOL_MODULE } from '../utils/constants';
import { getZenMLServerUrl, updateServerUrlAndToken } from '../utils/global';
import { debounce, refreshUIComponents } from '../utils/refresh';
import { EventBus } from './EventBus';
import { ZenExtension } from './ZenExtension';
import * as vscode from 'vscode';

export class LSClient {
  public isZenMLReady = false;
  private static instance: LSClient | null = null;
  private client: LanguageClient | null = null;
  private eventBus: EventBus = EventBus.getInstance();
  public clientReady: boolean = false;
  public interpreterSelectionInProgress = false;

  public restartLSPServerDebounced = debounce(async () => {
    await commands.executeCommand(`${PYTOOL_MODULE}.restart`);
    await refreshUIComponents();
  }, 500);

  /**
   * Sets up notification listeners for the language client.
   *
   * @returns void
   */
  public setupNotificationListeners(): void {
    if (this.client) {
      this.client.onNotification('zenml/serverChanged', this.handleServerChanged.bind(this));
      this.client.onNotification('zenml/stackChanged', this.handleStackChanged.bind(this));
      this.client.onNotification('zenml/ready', this.handleZenMLReady.bind(this));
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
        this.eventBus.emit('lsClientReady', true);
        this.setupNotificationListeners();
        console.log('Language client started successfully.');
        if (!this.isZenMLReady) {
          await vscode.commands.executeCommand(`${PYTOOL_MODULE}.checkZenMLInstallation`);
        }
      }
    } catch (error) {
      console.error('Failed to start the language client:', error);
    }
  }

  /**
   *  Handles the zenml/ready notification.
   *
   * @param params The ready status of ZenML.
   * @returns A promise resolving to void.
   */
  public async handleZenMLReady(params: { ready: boolean }): Promise<void> {
    console.log('ZENML/READY: ', params.ready);
    this.isZenMLReady = params.ready;
    if (!params.ready) {
      console.log('ZenML is not installed.');
      if (!this.interpreterSelectionInProgress) {
        await vscode.commands.executeCommand('zenml.promptForInterpreter');
      }
    } else {
      console.log('ZenML is installed, setting up extension components...');
      await commands.executeCommand(`${PYTOOL_MODULE}.restart`);
      await ZenExtension.setupViewsAndCommands();
      this.eventBus.emit('zenmlReady/lsClientReady', true);
    }
  }

  /**
   * Handles the zenml/serverChanged notification.
   *
   * @param details The details of the server update.
   */
  public async handleServerChanged(details: ConfigUpdateDetails): Promise<void> {
    if (this.isZenMLReady) {
      console.log('Received zenml/serverChanged notification');

      const currentServerUrl = getZenMLServerUrl();
      const { url, api_token } = details;
      if (currentServerUrl !== url) {
        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: 'ZenML config change detected',
            cancellable: false,
          },
          async progress => {
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
        this.eventBus.emit('lsClientReady', false);
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
   */
  public async handleStackChanged(activeStackId: string): Promise<void> {
    console.log('Received zenml/stackChanged notification:', activeStackId);
    await storeActiveStack(activeStackId);
    this.eventBus.emit('stackChanged', activeStackId);
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
    if (!this.clientReady || !this.client) {
      console.log('Language server is not available.');
      throw new Error('Language client is not available.');
    }
    try {
      const result = await this.client.sendRequest('workspace/executeCommand', {
        command: `${PYTOOL_MODULE}.${command}`,
        arguments: args,
      });
      return result as T;
    } catch (error) {
      console.error(`Failed to execute command ${command}:`, error);
      throw error;
    }
  }

  /**
   * Updates the language client.
   *
   * @param {LanguageClient} updatedCLient The new language client.
   */
  public updateClient(updatedCLient: LanguageClient): void {
    this.client = updatedCLient;
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
