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
import { PYTOOL_MODULE } from '../../../utils/constants';
import { MockEventBus } from './MockEventBus';
import { MOCK_REST_SERVER_DETAILS, MOCK_REST_SERVER_URL } from './constants';

interface MockLanguageClient {
  start: () => Promise<void>;
  onNotification: (type: string, handler: (params: any) => void) => void;
  sendRequest: (command: string, args?: any) => Promise<any>;
}

export class MockLSClient {
  notificationHandlers: Map<string, (params: any) => void> = new Map();
  mockLanguageClient: MockLanguageClient;
  eventBus: MockEventBus;

  constructor(eventBus: MockEventBus) {
    this.eventBus = eventBus;
    this.mockLanguageClient = {
      start: async () => { },
      onNotification: (type: string, handler: (params: any) => void) => {
        this.notificationHandlers.set(type, handler);
      },
      sendRequest: async (command: string, args?: any) => {
        if (command === 'workspace/executeCommand') {
          return this.handleExecuteCommand(args);
        } else {
          throw new Error(`Unmocked command: ${command}`);
        }
      },
    };
  }

  public handleExecuteCommand(args: any): Promise<any> {
    const { command, arguments: cmdArgs } = args;
    switch (command) {
      case `${PYTOOL_MODULE}.serverInfo`:
        return Promise.resolve(MOCK_REST_SERVER_DETAILS);
      case `${PYTOOL_MODULE}.renameStack`:
        const [renameStackId, newStackName] = cmdArgs;
        if (renameStackId && newStackName) {
          return Promise.resolve({
            message: `Stack ${renameStackId} successfully renamed to ${newStackName}.`,
          });
        } else {
          return Promise.resolve({ error: 'Failed to rename stack' });
        }
      case `${PYTOOL_MODULE}.copyStack`:
        const [copyStackId, copyNewStackName] = cmdArgs;
        if (copyStackId && copyNewStackName) {
          return Promise.resolve({
            message: `Stack ${copyStackId} successfully copied to ${copyNewStackName}.`,
          });
        } else {
          return Promise.resolve({ error: 'Failed to copy stack' });
        }
      case `${PYTOOL_MODULE}.switchActiveStack`:
        const [stackNameOrId] = cmdArgs;
        if (stackNameOrId) {
          return Promise.resolve({ message: `Active stack set to: ${stackNameOrId}` });
        } else {
          return Promise.resolve({ error: 'Failed to set active stack' });
        }
      default:
        throw new Error(`Unmocked PYTOOL_MODULE command: ${command}`);
    }
  }

  /**
   * Mocks sending a request to the language server.
   *
   * @param command The command to send to the language server.
   * @param args The arguments to send with the command.
   * @returns A promise resolving to a mocked response from the language server.
   */
  async sendLsClientRequest(command: string, args: any[] = []): Promise<any> {
    if (command === 'connect') {
      if (args[0] === MOCK_REST_SERVER_URL) {
        return Promise.resolve({
          message: 'Connected successfully',
          access_token: 'valid_token',
        });
      } else {
        return Promise.reject(new Error('Failed to connect with incorrect URL'));
      }
    } else if (command === 'disconnect') {
      return Promise.resolve({ message: 'Disconnected successfully' });
    } else {
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
      if (type === 'zenml/configUpdated') {
        this.eventBus.emit('zenml/configUpdated', {
          updatedServerConfig: params,
        });
      } else if (type === 'zenml/requirementNotMet') {
        this.eventBus.emit('lsClientReady', false);
      } else if (type === 'zenml/ready') {
        this.eventBus.emit('lsClientReady', true);
      }
    }
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
}
