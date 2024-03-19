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
import { ZenServerDetails } from '../types/ServerInfoTypes';
import { EventBus } from './EventBus';

export class LSClient {
  private static instance: LSClient | null = null;
  private client: LanguageClient | null = null;
  private eventBus: EventBus = EventBus.getInstance();

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
        this.eventBus.emit('lsClientReady', true);
        this.setupNotificationListeners(this.client);
      }
    } catch (error) {
      console.error('Failed to start the language client:', error);
    }
  }

  /**
   * Adds listeners to the language client.
   * Listens to notifications from the language server and emits events accordingly.
   *
   * @param lsClient The language client to add listeners to.
   * @returns void
   */
  private setupNotificationListeners(lsClient: LanguageClient): void {
    lsClient.onNotification('zenml/ready', params => {
      console.log('Received zenml/ready notification:', params);

      this.eventBus.emit('zenml/ready', params);
    });

    lsClient.onNotification('zenml/configUpdated', async params => {
      console.log('Received zenml/configUpdated notification:', params);

      this.eventBus.emit('zenml/configUpdated', {
        updatedServerConfig: params.serverDetails as ZenServerDetails,
      });
    });
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

