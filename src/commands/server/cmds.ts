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
import * as vscode from 'vscode';
import { EventBus } from '../../services/EventBus';
import { LSClient } from '../../services/LSClient';
import {
  ConnectServerResponse,
  GenericLSClientResponse,
  RestServerConnectionResponse,
} from '../../types/LSClientResponseTypes';
import { ANALYTICS_TRACK } from '../../utils/constants';
import { updateServerUrlAndToken } from '../../utils/global';
import { refreshUtils } from '../../utils/refresh';
import { ServerDataProvider } from '../../views/activityBar';
import { promptAndStoreServerUrl } from './utils';

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  EventBus.getInstance().emit(ANALYTICS_TRACK, { event, properties });
};

/**
 * Shows a quick pick to select the type of ZenML server connection.
 *
 * @returns {Promise<string | undefined>} The selected connection type or undefined if cancelled.
 */
const selectConnectionType = async (): Promise<{ type: string; url?: string } | undefined> => {
  const items = [
    {
      label: '$(globe) Connect to Remote ZenML Server',
      value: 'remote',
    },
    {
      label: '$(server) Start Local ZenML Server',
      value: 'local',
    },
  ];

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a ZenML server connection type',
  });

  if (!selection) {
    return undefined;
  }

  if (selection.value === 'remote') {
    const url = await promptAndStoreServerUrl();
    if (!url) {
      return undefined;
    }
    return { type: 'remote', url };
  }

  return { type: selection.value };
};

/**
 * Prompts for local server options when starting a local server.
 *
 * @returns {Promise<object | undefined>} Local server configuration options
 */
const promptLocalServerOptions = async (): Promise<object | undefined> => {
  const useDocker = await vscode.window.showQuickPick(['Yes', 'No'], {
    placeHolder: 'Run in Docker container?',
  });

  if (!useDocker) {
    return undefined;
  }

  const docker = useDocker === 'Yes';

  const portInput = await vscode.window.showInputBox({
    prompt: 'Enter port number (optional)',
    placeHolder: 'Leave empty for default port',
    validateInput: value => {
      if (!value) {
        return null;
      }
      const port = parseInt(value);
      if (isNaN(port) || port < 1 || port > 65535) {
        return 'Please enter a valid port number (1-65535)';
      }
      return null;
    },
  });

  if (portInput === undefined) {
    return undefined;
  }

  const port = portInput ? parseInt(portInput) : undefined;

  return { docker, port, restart: false };
};

/**
 * Initiates a connection to a ZenML server - allowing the user to choose between
 * standard remote server, ZenML Pro, or starting a local server.
 *
 * @returns {Promise<boolean>} Resolves after attempting to connect to the server.
 */
const connectServer = async (): Promise<boolean> => {
  const selection = await selectConnectionType();
  if (!selection) {
    return false;
  }

  let url: string;
  let connectionType: string;
  let options: object = {};

  switch (selection.type) {
    case 'remote':
      connectionType = 'remote';
      url = selection.url || '';
      break;
    case 'local': {
      connectionType = 'local';
      const localOptions = await promptLocalServerOptions();
      if (!localOptions) {
        return false;
      }
      options = localOptions;
      break;
    }
    default:
      return false;
  }

  return new Promise<boolean>(resolve => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to ${
          selection.type === 'local' ? 'local ZenML server' : 'ZenML server'
        }...`,
        cancellable: true,
      },
      async () => {
        try {
          const lsClient = LSClient.getInstance();
          const result = await lsClient.sendLsClientRequest<ConnectServerResponse>('connect', [
            connectionType,
            url,
            options,
            true, // verify_ssl
          ]);

          if (result && 'error' in result) {
            throw new Error(result.error);
          }

          // If we have an access token (standard connection), update it
          if ('access_token' in result) {
            const accessToken = (result as RestServerConnectionResponse).access_token;
            await updateServerUrlAndToken(
              selection.type === 'remote' ? selection.url! : '',
              accessToken
            );
          }

          await refreshUtils.refreshUIComponents();

          // Show success message in tree view
          vscode.window.showInformationMessage('Connected to server');
          trackEvent('server.connect_command', { connectionType, success: true });
          resolve(true);
        } catch (error) {
          console.error('Failed to connect to ZenML server:', error);
          trackEvent('server.connect_command', { connectionType, success: false });

          // Show error in tree view instead of notification
          vscode.window.showErrorMessage(`Failed to connect to ZenML server: ${error}`);
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
      cancellable: true,
    },
    async () => {
      try {
        const lsClient = LSClient.getInstance();
        const result = await lsClient.sendLsClientRequest<GenericLSClientResponse>('disconnect');
        if (result && 'error' in result) {
          throw result;
        }
        await refreshUtils.refreshUIComponents();

        // Show success message in tree view
        vscode.window.showInformationMessage('Disconnected from server');
        trackEvent('server.disconnect_command', { success: true });
      } catch (error: any) {
        console.error('Failed to disconnect from ZenML server:', error);
        trackEvent('server.disconnect_command', { success: false });

        // Show error in tree view instead of notification
        vscode.window.showErrorMessage(`Failed to disconnect from ZenML server: ${error}`);
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
      cancellable: false,
    },
    async () => {
      await ServerDataProvider.getInstance().refresh();
    }
  );
};

export const serverCommands = {
  connectServer,
  disconnectServer,
  refreshServerStatus,
};
