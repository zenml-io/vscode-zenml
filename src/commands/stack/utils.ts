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
import { PYTOOL_MODULE } from '../../utils/constants';
import { GetActiveStackResponse, SetActiveStackResponse } from '../../types/LSClientResponseTypes';
import { showErrorMessage, showInformationMessage } from '../../utils/notifications';

/**
 * Switches the active ZenML stack to the specified stack name.
 *
 * @param {string} stackNameOrId - The id or name of the ZenML stack to be activated.
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the newly activated stack, or undefined on error.
 */
export const switchActiveStack = async (stackNameOrId: string): Promise<{ id: string; name: string } | undefined> => {
  const lsClient = LSClient.getInstance().getLanguageClient();
  if (!lsClient) {
    throw new Error('Language client not found');
  }

  try {
    const result = (await lsClient.sendRequest('workspace/executeCommand', {
      command: `${PYTOOL_MODULE}.switchActiveStack`,
      arguments: [stackNameOrId],
    })) as SetActiveStackResponse;

    if ('error' in result) {
      console.log('Error in switchZenMLStack result', result);
      throw new Error(result.error);
    }

    const { id, name } = result;
    await storeActiveStack(id, name);
    return { id, name };
  } catch (error: any) {
    console.error(`Error setting active stack: ${error}`);
    showErrorMessage(`Failed to set active stack: ${error.message}`);
  }
}

/**
 * Retrieves the currently active ZenML stack. If the active stack is stored in the global configuration,
 * it uses that information. Otherwise, it fetches the active stack using a Python script.
 *
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the active stack, or undefined on error;
 */
export const getActiveStack = async (): Promise<{ id: string; name: string } | undefined> => {
  const lsClientInstance = LSClient.getInstance();
  const lsClient = lsClientInstance.getLanguageClient();

  if (!lsClient) {
    console.log('getActiveStack: Language client not ready yet.');
    // showErrorMessage('Language server is not available.');
    return;
  }

  try {
    const result = (await lsClient.sendRequest('workspace/executeCommand', {
      command: `${PYTOOL_MODULE}.getActiveStack`,
    })) as GetActiveStackResponse;

    if ('error' in result) {
      throw new Error(result.error);
    }

    const { id, name } = result;
    await storeActiveStack(id, name);
    return { id, name };
  } catch (error: any) {
    console.error(`Error getting active stack information: ${error}`);
    showErrorMessage(`Failed to get active stack information: ${error.message}`);
    return undefined;
  }
}

/**
 * Stores the specified ZenML stack id and name in the global configuration.
 *
 * @param {string} id - The id of the ZenML stack to be stored.
 * @param {string} name - The name of the ZenML stack to be stored.
 * @returns {Promise<void>} A promise that resolves when the stack information has been successfully stored.
 */
export const storeActiveStack = async (id: string, name: string): Promise<void> => {
  const config = vscode.workspace.getConfiguration('zenml');
  await config.update('activeStackId', id, vscode.ConfigurationTarget.Global);
  await config.update('activeStackName', name, vscode.ConfigurationTarget.Global);
}

const stackUtils = {
  switchActiveStack,
  getActiveStack,
  storeActiveStack,
};

export default stackUtils;