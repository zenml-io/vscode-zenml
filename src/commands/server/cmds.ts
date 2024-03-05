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
import { ZenMLClient } from '../../services/ZenMLClient';
import {
  PipelineDataProvider,
  ServerDataProvider,
  StackDataProvider,
} from '../../views/activityBar';
import {
  disconnectFromZenMLServer,
  initiateDeviceAuthorization,
  promptAndStoreServerUrl,
} from './utils';

/**
 * Initiates a connection to the ZenML server using a Flask service for OAuth2 authentication.
 * The service handles user authentication, device authorization, and updates the global configuration upon success.
 *
 * @param {ServerDataProvider} serverDataProvider Manages and updates the server-related UI.
 * @param {StackDataProvider} stackDataProvider Manages and updates the stack-related UI.
 * @returns {Promise<boolean>} Resolves after attempting to connect to the server.
 */
const connectServer = async (
  serverDataProvider: ServerDataProvider,
  stackDataProvider: StackDataProvider,
  pipelineDataProvider: PipelineDataProvider
): Promise<boolean> => {
  const zenmlClient = ZenMLClient.getInstance();
  await promptAndStoreServerUrl();

  const serverUrl = zenmlClient.getZenMLServerUrl();
  console.log("serverUrl after prompting user to enter server URL: ", serverUrl)
  if (!serverUrl) {
    vscode.window.showErrorMessage('Server URL is required to connect.');
    return false;
  }

  // Fetch Server ID and initiate device authorization
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Connecting to ZenML server...',
      cancellable: false,
    },
    async progress => {
      try {
        await initiateDeviceAuthorization();
        serverDataProvider.reactivate();
        serverDataProvider.serverStatusService.reactivate();
        stackDataProvider.reactivate();
        pipelineDataProvider.reactivate();

        await serverDataProvider.serverStatusService.updateStatus();
        await serverDataProvider.refresh();
        await stackDataProvider.refresh();
        await pipelineDataProvider.refresh();
        vscode.window.showInformationMessage(
          'Successfully connected and authenticated with the ZenML server.'
        );
        return true;
      } catch (error) {
        console.error(`Connection and authentication error: ${error}`);
        vscode.window.showErrorMessage(
          'Connection and authentication error. Please check the console for more details.'
        );
        return false;
      }
    }
  );
};

/**
 * Disconnects from the ZenML server using the Flask service, ensuring proper cleanup and configuration reset.
 *
 * @param {ServerDataProvider} serverDataProvider Manages and updates the server-related UI.
 * @param {StackDataProvider} stackDataProvider Manages and updates the stack-related UI.
 * @returns {Promise<void>} Resolves after successfully disconnecting from the server.
 */
const disconnectServer = async (
  serverDataProvider: ServerDataProvider,
  stackDataProvider: StackDataProvider,
  pipelineDataProvider: PipelineDataProvider
): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Disconnecting from ZenML server...',
      cancellable: false,
    },
    async () => {
      const success = await disconnectFromZenMLServer(
        serverDataProvider,
        stackDataProvider,
        pipelineDataProvider
      );
      if (success) {
        vscode.window.showInformationMessage('Successfully disconnected from ZenML server.');
        await serverDataProvider.refresh();
      } else {
        vscode.window.showErrorMessage('Failed to disconnect from ZenML server.');
      }
    }
  );
};

/**
 * Triggers a refresh of the server status within the UI components.
 *
 * @param {ServerDataProvider} serverDataProvider Manages and updates the server-related UI components.
 * @returns {Promise<void>} Resolves after refreshing the server status.
 */
const refreshServerStatus = async (serverDataProvider: ServerDataProvider): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Refreshing server status...',
    },
    async () => {
      await serverDataProvider.refresh();
    }
  );
};

export { connectServer, disconnectServer, refreshServerStatus };
