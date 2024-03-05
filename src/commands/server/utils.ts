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
import axios from 'axios';
import {
  PipelineDataProvider,
  ServerDataProvider,
  StackDataProvider,
} from '../../views/activityBar';

/**
 * Setup for ZenML server connection + authentication:
 * 1. Prompts the user to enter the server URL and stores it in the global configuration.
 * 2. Makes a GET request to /info to fetch the ID from the server.
 * 3. Initiates the device authorization flow with the server by making a POST request to /device_authorization.
 * 4. This will return device_code, user_code, and verification_uri_complete.
 * 5. The user is prompted to open the verification URI in a browser.
 * 6. While waiting for the user to authorize the device in the browser, we poll the /login route to fetch the access token.
 * 7. Once the access token is fetched, we store it in the global configuration.
 */

export async function promptAndStoreServerUrl() {
  let serverUrl = await vscode.window.showInputBox({
    prompt: 'Enter the ZenML server URL',
    placeHolder: 'https://<your-zenml-server-url>',
  });

  serverUrl = serverUrl?.trim();

  if (serverUrl) {
    let cleanedServerUrl = serverUrl.replace(/\/$/, '');
    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('serverUrl', cleanedServerUrl, vscode.ConfigurationTarget.Global);
  }
}

async function fetchServerId(serverUrl: string): Promise<string> {
  try {
    const response = await axios.get(`${serverUrl}/api/v1/info`);
    const serverId = response.data.id;
    console.log('Fetched server ID:', serverId);
    return serverId;
  } catch (error) {
    console.error('Error fetching server info:', error);
    vscode.window.showErrorMessage(
      'Failed to fetch server info. Check the console for more details.'
    );
    throw error;
  }
}

export async function initiateDeviceAuthorization() {
  const serverUrl = vscode.workspace.getConfiguration('zenml').get<string>('serverUrl') || '';

  if (!serverUrl) {
    vscode.window.showErrorMessage('ZenML server URL is not configured.');
    return;
  }

  const clientId = await fetchServerId(serverUrl);

  try {
    const bodyFormData = new URLSearchParams();
    bodyFormData.append('client_id', clientId);

    const response = await axios.post(`${serverUrl}/api/v1/device_authorization`, bodyFormData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { device_code, verification_uri_complete } = response.data;
    console.log('Verification URI:', verification_uri_complete);

    const openUrl = await vscode.window.showInformationMessage(
      'You need to authorize your device. Do you want to open the authorization page?',
      'Open',
      'Cancel'
    );

    if (openUrl === 'Open') {
      vscode.env.openExternal(vscode.Uri.parse(verification_uri_complete));
    }

    await pollForAccessToken(serverUrl, device_code, clientId);
  } catch (error) {
    console.error('Error initiating device authorization:', error);
    vscode.window.showErrorMessage(
      'Failed to initiate device authorization. Check the console for more details.'
    );
  }
}

export async function pollForAccessToken(
  serverUrl: string,
  deviceCode: string,
  clientId: string
): Promise<void> {
  const loginUrl = `${serverUrl}/api/v1/login`;
  let attempts = 0;
  const maxAttempts = 60;
  const intervalSeconds = 5;

  while (attempts < maxAttempts) {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
      params.append('client_id', clientId);
      params.append('device_code', deviceCode);

      const response = await axios.post(loginUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.data && response.data.access_token) {
        console.log('Access token:', response.data.access_token);
        const config = vscode.workspace.getConfiguration('zenml');
        await config.update(
          'accessToken',
          response.data.access_token,
          vscode.ConfigurationTarget.Global
        );
        return response.data.access_token;
      } else {
        throw new Error('Unexpected response data structure.');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error === 'authorization_pending') {
        console.log('Authorization pending...');
        attempts++;
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      } else {
        console.error('Error polling for access token:', error);
        vscode.window.showErrorMessage(
          'Error occurred while polling for access token. Check the console for details.'
        );
      }
    }
  }
}

export async function disconnectFromZenMLServer(
  serverDataProvider: ServerDataProvider,
  stackDataProvider: StackDataProvider,
  pipelineDataProvider: PipelineDataProvider
): Promise<boolean> {
  try {
    const zenmlClient = ZenMLClient.getInstance();
    await zenmlClient.request('get', '/logout')

    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('serverUrl', undefined, vscode.ConfigurationTarget.Global);
    await config.update('accessToken', undefined, vscode.ConfigurationTarget.Global);

    serverDataProvider.serverStatusService.resetStatus();

    serverDataProvider.reset();
    stackDataProvider.reset();
    pipelineDataProvider.reset();
    ZenMLClient.resetInstance();
    return true;
  } catch (error) {
    console.error('Failed to disconnect from ZenML server:', error);
    return false;
  }
}
