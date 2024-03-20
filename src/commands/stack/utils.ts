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
import { LSClient } from '../../services/LSClient';
import { GetActiveStackResponse, SetActiveStackResponse } from '../../types/LSClientResponseTypes';
import { showErrorMessage } from '../../utils/notifications';

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
    if ('error' in result) {
      console.log('Error in switchZenMLStack result', result);
      throw new Error(result.error);
    }
    const { id, name } = result;
    await storeActiveStack(id);
    return { id, name };
  } catch (error: any) {
    console.error(`Error setting active stack: ${error}`);
    showErrorMessage(`Failed to set active stack: ${error.message}`);
  }
};

/**
 * Gets the id and name of the active ZenML stack.
 *
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the active stack, or undefined on error;
 */
export const getActiveStack = async (): Promise<{ id: string; name: string } | undefined> => {
  try {
    const lsClient = LSClient.getInstance();
    const result = await lsClient.sendLsClientRequest<GetActiveStackResponse>('getActiveStack');

    if ('error' in result) {
      throw new Error(result.error);
    }

    const { id, name } = result;
    await storeActiveStack(id);
    return { id, name };
  } catch (error: any) {
    console.error(`Error getting active stack information: ${error}`);
    showErrorMessage(`Failed to get active stack information: ${error.message}`);
    return undefined;
  }
};

/**
 * Stores the specified ZenML stack id in the global configuration.
 *
 * @param {string} id - The id of the ZenML stack to be stored.
 * @returns {Promise<void>} A promise that resolves when the stack information has been successfully stored.
 */
export const storeActiveStack = async (id: string): Promise<void> => {
  const config = vscode.workspace.getConfiguration('zenml');
  await config.update('activeStackId', id, vscode.ConfigurationTarget.Global);
};

export const getActiveStackIdFromConfig = (): string | undefined => {
  const config = vscode.workspace.getConfiguration('zenml');
  return config.get<string>('activeStackId');
};

const stackUtils = {
  switchActiveStack,
  getActiveStack,
  storeActiveStack,
};

export default stackUtils;
