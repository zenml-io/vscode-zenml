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
import { GetActiveStackResponse, SetActiveStackResponse } from '../../types/LSClientResponseTypes';
import { showErrorMessage } from '../../utils/notifications';
import { ServerDataProvider } from '../../views/activityBar';
import { buildWorkspaceProjectUrl, getBaseUrl, isServerStatus } from '../server/utils';

/**
 * Switches the active ZenML stack to the specified stack name.
 *
 * @param {string} stackNameOrId - The id or name of the ZenML stack to be activated.
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the newly activated stack, or undefined on error.
 */
export const switchActiveStack = async (
  stackNameOrId: string
): Promise<{ id: string; name: string } | undefined> => {
  try {
    const lsClient = LSClient.getInstance();
    const result = await lsClient.sendLsClientRequest<SetActiveStackResponse>('switchActiveStack', [
      stackNameOrId,
    ]);
    if (result && 'error' in result) {
      throw new Error(result.error);
    }
    const { id, name } = result;

    try {
      await storeActiveStackId(id);
    } catch (storageError) {
      console.error(`Error storing active stack ID: ${storageError}`);
    }

    return { id, name };
  } catch (error: any) {
    console.error(`Error setting active stack: ${error}`);
    showErrorMessage(`Failed to set active stack: ${error.message}`);
  }
};

/**
 * Gets the id and name of the active ZenML stack.
 *
 * @returns {Promise<{id: string, name: string, components?: any}>} A promise that resolves with the active stack details, or undefined on error
 */
export const getActiveStack = async (): Promise<GetActiveStackResponse | undefined> => {
  const lsClient = LSClient.getInstance();
  if (!lsClient.clientReady) {
    return;
  }

  try {
    const result = await lsClient.sendLsClientRequest<GetActiveStackResponse>('getActiveStack');
    if (result && 'error' in result) {
      throw new Error(result.error);
    }

    return result;
  } catch (error: any) {
    console.error(`Failed to get active stack information: ${error}`);
    return undefined;
  }
};

/**
 * Gets the id and name of the active ZenML stack.
 *
 * @returns {Promise<{id: string, name: string, components?: any}>} A promise that resolves with the active stack details, or undefined on error
 */
export const getStackById = async (id: string): Promise<GetActiveStackResponse | undefined> => {
  const lsClient = LSClient.getInstance();
  if (!lsClient.clientReady) {
    return;
  }

  try {
    const result = await lsClient.sendLsClientRequest<GetActiveStackResponse>('getStackById', [id]);
    if (result && 'error' in result) {
      throw new Error(result.error);
    }

    return result;
  } catch (error: any) {
    console.error(`Failed to get stack by id: ${error}`);
    return undefined;
  }
};

/**
 * Stores the specified ZenML stack id in the global configuration.
 *
 * @param {string} id - The id of the ZenML stack to be stored.
 * @returns {Promise<void>} A promise that resolves when the stack information has been successfully stored.
 */
export const storeActiveStackId = async (id: string): Promise<void> => {
  try {
    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('activeStackId', id, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error(`Failed to store active stack ID in settings: ${error}`);
    setTimeout(async () => {
      try {
        const config = vscode.workspace.getConfiguration('zenml');
        await config.update('activeStackId', id, vscode.ConfigurationTarget.Global);
      } catch (retryError) {
        console.error(`Failed to store active stack ID on retry: ${retryError}`);
      }
    }, 500);
  }
};

/**
 * Gets the active stack id from the global configuration.
 *
 * @returns {string | undefined} The active stack id.
 */
export const getActiveStackIdFromConfig = (): string | undefined => {
  const config = vscode.workspace.getConfiguration('zenml');
  return config.get<string>('activeStackId');
};

/**
 * Gets the Dashboard URL for the corresponding ZenML stack
 *
 * @param {string} id - The id of the ZenML stack to be opened
 * @returns {string} - The URL corresponding to the pipeline in the ZenML Dashboard
 */
export const getStackDashboardUrl = (id: string): string => {
  if (!id) {
    return '';
  }

  const serverStatus = ServerDataProvider.getInstance().getCurrentStatus();
  if (!isServerStatus(serverStatus) || serverStatus.deployment_type === 'other') {
    return '';
  }

  const baseUrl = getBaseUrl(serverStatus.dashboard_url);
  const suffix = `/stacks/${id}/configuration`;

  const url = buildWorkspaceProjectUrl(baseUrl, serverStatus, suffix);

  return url;
};

const stackUtils = {
  switchActiveStack,
  getActiveStack,
  storeActiveStackId,
  getStackDashboardUrl,
  getStackById,
};

export default stackUtils;
