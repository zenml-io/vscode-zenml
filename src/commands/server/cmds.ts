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
import { promptAndStoreServerUrl } from './utils';
import { LSClient } from '../../services/LSClient';
import { getZenMLServerUrl } from '../../utils/global';
import { EventBus } from '../../services/EventBus';
import {
  ConnectServerResponse,
  RestServerConnectionResponse,
} from '../../types/LSClientResponseTypes';
import { showInformationMessage } from '../../utils/notifications';
import { refreshUtils } from '../../utils/refresh';

/**
 * Initiates a connection to the ZenML server using a Flask service for OAuth2 authentication.
 * The service handles user authentication, device authorization, and updates the global configuration upon success.
 *
 * @returns {Promise<boolean>} Resolves after attempting to connect to the server.
 */
const connectServer = async (): Promise<boolean> => {
  await promptAndStoreServerUrl();

  const url = getZenMLServerUrl();
  if (!url) {
    vscode.window.showErrorMessage('Server URL is required to connect.');
    return false;
  }

  return new Promise<boolean>(resolve => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Connecting to ZenML server...',
        cancellable: false,
      },
      async progress => {
        progress.report({ increment: 0 });

        try {
          const lsClient = LSClient.getInstance();
          const result = await lsClient.sendLsClientRequest<ConnectServerResponse>('connect', [
            url,
          ]);

          if (result && 'error' in result && result.error) {
            throw new Error(result.error);
          }

          const config = vscode.workspace.getConfiguration('zenml');
          await config.update('serverUrl', url, vscode.ConfigurationTarget.Global);
          await config.update(
            'accessToken',
            (result as RestServerConnectionResponse).access_token,
            vscode.ConfigurationTarget.Global
          );

          await refreshUtils.refreshUIComponents();
          progress.report({ increment: 100 });
          resolve(true);
        } catch (error) {
          console.error('Failed to connect to ZenML server:', error);
          vscode.window.showErrorMessage(
            `Failed to connect to ZenML server: ${(error as Error).message}`
          );
          progress.report({ increment: 100 });
          resolve(false);
        }
      }
    );
  });
};

/**
 * Disconnects from the ZenML server and clears related configuration and state in the application.
 *
 * @returns {Promise<void>} Resolves after successfully disconnecting from the server.
 */
const disconnectServer = async (): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Disconnecting from ZenML server...',
      cancellable: false,
    },
    async () => {
      try {
        const lsClient = LSClient.getInstance();
        const result = await lsClient.sendLsClientRequest('disconnect');
        if ('error' in result && result.error) {
          throw new Error(result.error);
        }
        await refreshUtils.refreshUIComponents();
      } catch (error: any) {
        console.error('Failed to disconnect from ZenML server:', error);
        vscode.window.showErrorMessage('Failed to disconnect from ZenML server: ' + error);
      }
    }
  );
};

/**
 * Triggers a refresh of the server status within the UI components.
 *
 * @returns {Promise<void>} Resolves after refreshing the server status.
 */
const refreshServerStatus = async (): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Refreshing server status...',
      cancellable: false,
    },
    async () => {
      EventBus.getInstance().emit('refreshServerStatus');
      showInformationMessage('Server status refreshed.');
    }
  );
};

export const serverCommands = {
  connectServer,
  disconnectServer,
  refreshServerStatus,
};
