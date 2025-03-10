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
import { LSClient } from '../../services/LSClient';
import { ServerStatusInfoResponse } from '../../types/LSClientResponseTypes';
import { ServerStatus, ZenServerDetails } from '../../types/ServerInfoTypes';
import { INITIAL_ZENML_SERVER_STATUS } from '../../utils/constants';
import { ErrorTreeItem, createErrorItem } from '../../views/activityBar/common/ErrorTreeItem';

/**
 * Prompts the user to enter the ZenML server URL and stores it in the global configuration.
 */
export async function promptAndStoreServerUrl(): Promise<string | undefined> {
  let serverUrl = await vscode.window.showInputBox({
    prompt: 'Enter the ZenML server URL',
    placeHolder: 'https://<your-zenml-server-url>',
  });

  serverUrl = serverUrl?.trim();

  if (serverUrl) {
    serverUrl = serverUrl.replace(/\/$/, '');
    // Validate the server URL format before storing
    if (!/^https?:\/\/[^\s$.?#].[^\s]*$/.test(serverUrl)) {
      vscode.window.showErrorMessage('Invalid server URL format.');
      return;
    }
    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('serverUrl', serverUrl, vscode.ConfigurationTarget.Global);
  }

  return serverUrl;
}

/**
 * Retrieves the server status from the language server or the provided server details.
 *
 * @returns {Promise<ServerStatus>} A promise that resolves with the server status, parsed from server details.
 */
export async function checkServerStatus(): Promise<ServerStatus | ErrorTreeItem[]> {
  const lsClient = LSClient.getInstance();
  // For debugging
  if (!lsClient.clientReady) {
    return INITIAL_ZENML_SERVER_STATUS;
  }

  try {
    const result = await lsClient.sendLsClientRequest<ServerStatusInfoResponse>('serverInfo');
    if (!result || 'error' in result) {
      if ('clientVersion' in result && 'serverVersion' in result) {
        return createErrorItem(result);
      }
    } else if (isZenServerDetails(result)) {
      return createServerStatusFromDetails(result);
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
  const { deployment_type, dashboard_url } = storeInfo;

  const dashboardUrl =
    deployment_type === 'cloud'
      ? dashboard_url
      : deployment_type === 'other'
        ? 'N/A'
        : storeConfig.url;

  return {
    ...storeInfo,
    isConnected: storeConfig?.type === 'rest',
    url: storeConfig?.url ?? 'unknown',
    store_type: storeConfig?.type ?? 'unknown',
    dashboard_url: dashboardUrl,
  };
}

export function isServerStatus(obj: any): obj is ServerStatus {
  return 'isConnected' in obj && 'url' in obj;
}

export const serverUtils = {
  promptAndStoreServerUrl,
  checkServerStatus,
  isZenServerDetails,
  createServerStatusFromDetails,
};
