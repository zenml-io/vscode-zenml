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
import { MockEventBus } from './MockEventBus';
import { MOCK_ACCESS_TOKEN, MOCK_REST_SERVER_DETAILS, MOCK_REST_SERVER_URL } from './constants';

interface MockLanguageClient {
  start: () => Promise<void>;
  onNotification: (type: string, handler: (params: any) => void) => void;
  sendRequest: (command: string, args?: any) => Promise<any>;
}

export class MockLSClient {
  notificationHandlers: Map<string, (params: any) => void> = new Map();
  mockLanguageClient: MockLanguageClient;
  eventBus: MockEventBus;
  private static instance: MockLSClient;
  public clientReady: boolean = true;

  constructor(eventBus: MockEventBus) {
    this.eventBus = eventBus;
    this.mockLanguageClient = {
      start: async () => { },
      onNotification: (type: string, handler: (params: any) => void) => {
        this.notificationHandlers.set(type, handler);
      },
      sendRequest: async (command: string, args?: any) => {
        if (command === 'workspace/executeCommand') {
          return this.sendLsClientRequest(args);
        } else {
          throw new Error(`Unmocked command: ${command}`);
        }
      },
    };
  }

  /**
 * Retrieves the singleton instance of EventBus.
 *
 * @returns {MockLSClient} The singleton instance.
 */
  public static getInstance(mockEventBus: MockEventBus): MockLSClient {
    if (!MockLSClient.instance) {
      MockLSClient.instance = new MockLSClient(mockEventBus);
    }
    return MockLSClient.instance;
  }

  /**
 * Starts the language client.
 */
  public startLanguageClient(): Promise<void> {
    return this.mockLanguageClient.start();
  }

  /**
   * Gets the mocked language client.
   *
   * @returns {MockLanguageClient} The mocked language client.
   */
  public getLanguageClient(): MockLanguageClient {
    return this.mockLanguageClient;
  }

  /**
   * Mocks sending a request to the language server.
   *
   * @param command The command to send to the language server.
   * @param args The arguments to send with the command.
   * @returns A promise resolving to a mocked response from the language server.
   */
  async sendLsClientRequest(command: string, args: any[] = []): Promise<any> {
    switch (command) {
      case 'connect':
        if (args[0] === MOCK_REST_SERVER_URL) {
          return Promise.resolve({
            message: 'Connected successfully',
            access_token: MOCK_ACCESS_TOKEN,
          });
        } else {
          return Promise.reject(new Error('Failed to connect with incorrect URL'));
        }
      case 'disconnect':
        return Promise.resolve({ message: 'Disconnected successfully' });
      case `serverInfo`:
        return Promise.resolve(MOCK_REST_SERVER_DETAILS);

      case `renameStack`:
        const [renameStackId, newStackName] = args;
        if (renameStackId && newStackName) {
          return Promise.resolve({
            message: `Stack ${renameStackId} successfully renamed to ${newStackName}.`,
          });
        } else {
          return Promise.resolve({ error: 'Failed to rename stack' });
        }

      case `copyStack`:
        const [copyStackId, copyNewStackName] = args;
        if (copyStackId && copyNewStackName) {
          return Promise.resolve({
            message: `Stack ${copyStackId} successfully copied to ${copyNewStackName}.`,
          });
        } else {
          return Promise.resolve({ error: 'Failed to copy stack' });
        }

      case `switchActiveStack`:
        const [stackNameOrId] = args;
        if (stackNameOrId) {
          return Promise.resolve({ message: `Active stack set to: ${stackNameOrId}` });
        } else {
          return Promise.resolve({ error: 'Failed to set active stack' });
        }

      default:
        return Promise.reject(new Error(`Unmocked command: ${command}`));
    }
  }

  /**
   * Triggers a notification with the given type and parameters.
   *
   * @param type The type of the notification.
   * @param params The parameters of the notification.
   * @returns void
   */
  public triggerNotification(type: string, params: any): void {
    const handler = this.notificationHandlers.get(type);
    if (handler) {
      handler(params);
      if (type === 'zenml/serverChanged') {
        this.eventBus.emit('zenml/serverChanged', {
          updatedServerConfig: params,
        });
      } else if (type === 'zenml/requirementNotMet') {
        this.eventBus.emit('lsClientReady', false);
      } else if (type === 'zenml/ready') {
        this.eventBus.emit('lsClientReady', true);
      }
    }
  }


}
