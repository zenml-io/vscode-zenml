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
import { ServerStatus, ZenServerDetails } from '../../types/ServerInfoTypes';
import { LSClient } from '../../services/LSClient';
import { INITIAL_ZENML_SERVER_STATUS, PYTOOL_MODULE } from '../../utils/constants';
import { ServerStatusInfoResponse } from '../../types/LSClientResponseTypes';

/**
 * Prompts the user to enter the ZenML server URL and stores it in the global configuration.
 */
export async function promptAndStoreServerUrl() {
  let serverUrl = await vscode.window.showInputBox({
    prompt: 'Enter the ZenML server URL',
    placeHolder: 'https://<your-zenml-server-url>',
  });

  serverUrl = serverUrl?.trim();

  if (serverUrl) {
    let cleanedServerUrl = serverUrl.replace(/\/$/, '');
    // Validate the server URL format before storing
    if (!/^https?:\/\/[^\s$.?#].[^\s]*$/.test(cleanedServerUrl)) {
      vscode.window.showErrorMessage('Invalid server URL format.');
      return;
    }
    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('serverUrl', cleanedServerUrl, vscode.ConfigurationTarget.Global);
  }
}

/**
 * Retrieves the server status from the language server or the provided server details.
 *
 * @param {ZenServerDetails} [updatedServerConfig] The updated server configuration from the LSP server.
 * @returns {Promise<ServerStatus>} A promise that resolves with the server status, parsed from server details.
 */
export async function checkServerStatus(
  updatedServerConfig?: ZenServerDetails
): Promise<ServerStatus> {
  if (updatedServerConfig) {
    return createServerStatusFromDetails(updatedServerConfig);
  }
  const lsClient = LSClient.getInstance().getLanguageClient();
  if (!lsClient) {
    return INITIAL_ZENML_SERVER_STATUS;
  }

  try {
    const response = (await lsClient.sendRequest('workspace/executeCommand', {
      command: `${PYTOOL_MODULE}.serverInfo`,
    })) as ServerStatusInfoResponse;

    if ('error' in response && response.error) {
      console.error(response.error);
      return INITIAL_ZENML_SERVER_STATUS;
    } else if (isZenServerDetails(response)) {
      return createServerStatusFromDetails(response);
    }
  } catch (error) {
    console.error('Failed to fetch server information:', error);
  }
  return INITIAL_ZENML_SERVER_STATUS;
}

function isZenServerDetails(response: any): response is ZenServerDetails {
  return response && 'storeInfo' in response && 'storeConfig' in response;
}

function createServerStatusFromDetails(details: ZenServerDetails): ServerStatus {
  const { storeInfo, storeConfig } = details;
  return {
    ...storeInfo,
    isConnected: storeConfig?.type === 'rest',
    url: storeConfig?.url ?? 'unknown',
    store_type: storeConfig?.type ?? 'unknown',
  };
}

export const serverUtils = {
  promptAndStoreServerUrl,
  checkServerStatus,
  isZenServerDetails,
  createServerStatusFromDetails,
};
