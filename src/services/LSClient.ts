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
   * @param {LanguageClient} lsClient The new language client.
   */
  public updateClient(lsClient: LanguageClient): void {
    this.client = lsClient;
    this.setupNotificationListeners(this.client);
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
    lsClient.onNotification('zenml/requirementNotMet', params => {
      console.log('ZenML Python Client Requirements Not Met. Check Console for Details.');
      vscode.window.showErrorMessage(params.message);
      this.eventBus.emit('zenmlRequirementsNotMet');
    });

    lsClient.onNotification('zenml/configUpdated', async params => {
      this.eventBus.emit('serverConfigUpdated', {
        updatedServerConfig: params.serverDetails as ZenServerDetails,
      });
    });

    lsClient.onNotification('zenml/ready', async params => {
      this.eventBus.emit('zenmlClientAvailable', true);
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
