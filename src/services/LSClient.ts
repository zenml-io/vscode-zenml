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
import { LanguageClient } from 'vscode-languageclient/node';
import { ConfigUpdateDetails, ZenServerDetails } from '../types/ServerInfoTypes';
import { EventBus } from './EventBus';
import { GenericLSClientResponse } from '../types/LSClientResponseTypes';
import { PYTOOL_MODULE } from '../utils/constants';
import { debounce } from '../utils/refresh';
import { commands } from 'vscode';
import { getZenMLAccessToken, getZenMLServerUrl, updateAccessToken, updateServerUrl, updateServerUrlAndToken } from '../utils/global';
import { stackCommands } from '../commands/stack/cmds';
import { storeActiveStack, switchActiveStack } from '../commands/stack/utils';

export class LSClient {
  private static instance: LSClient | null = null;
  private client: LanguageClient | null = null;
  private eventBus: EventBus = EventBus.getInstance();
  private clientReady: boolean = false;

  public constructor() { }

  /**
   * Gets the language client.
   *
   * @returns {LanguageClient | null} The language client.
   */
  public getLanguageClient(): LanguageClient | null {
    return this.client;
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
   * Starts the language client.
   *
   * @returns A promise resolving to void.
   */
  public async startLanguageClient(): Promise<void> {
    try {
      if (this.client) {
        await this.client.start();
        console.log('Language client started successfully.');

        this.client.onNotification('zenml/configUpdated', async (params) => {
          console.log('Received zenml/configUpdated notification:', params);
          await this.handleConfigUpdated(params.server_details as ConfigUpdateDetails);
        });
        this.clientReady = true;
        this.eventBus.emit('lsClientReady', true);
      }
    } catch (error) {
      console.error('Failed to start the language client:', error);
    }
  }

  /**
 * Stops the language client.
 *
 * @returns A promise resolving to void.
 */
  public async stopLanguageClient(): Promise<void> {
    this.clientReady = false;
    this.eventBus.off('zenml/configUpdated', this.handleConfigUpdated.bind(this));
    try {
      if (this.client) {
        await this.client.stop();
        console.log('Language client stopped successfully.');
        this.eventBus.emit('lsClientReady', false);
      }
    } catch (error) {
      console.error('Failed to stop the language client:', error);
    }
  }

  public async restartServer(): Promise<void> {
    // this.eventBus.removeAllListeners();
    await this.stopLanguageClient();
    this.restartLSPServerDebounced();
  }


  private restartLSPServerDebounced = debounce(async () => {
    await commands.executeCommand('zenml-python.restart');
  }, 5000);



  public async handleConfigUpdated(updatedServerConfig: ConfigUpdateDetails): Promise<void> {
    const currentServerUrl = getZenMLServerUrl()
    const currentActiveStackId = getZenMLAccessToken();

    console.log('Checking for configuration changes...');
    const { url, api_token, active_stack_id } = updatedServerConfig;

    if (currentServerUrl !== url) {
      console.log('Server URL has changed. Updating configuration and restarting LSP server...');
      await updateServerUrl(url);
      await updateAccessToken(api_token);
      await this.restartServer();
    } else if (active_stack_id && currentActiveStackId !== active_stack_id) {
      console.log('Active stack ID has changed. Refreshing stack-related information...');
      await switchActiveStack(active_stack_id);
      await stackCommands.refreshActiveStack();
      await stackCommands.refreshStackView();
    }
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
        arguments: args
      });
      return result as T;
    } catch (error) {
      console.error(`Failed to execute command ${command}:`, error);
      throw error;
    }
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
