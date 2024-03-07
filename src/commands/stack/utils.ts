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
import { Shell } from '../../utils/Shell';

/**
 * Attempts to fetch the stack details for the given stack ID.
 *
 * @param {string} stackId The ID of the stack to fetch.
 * @returns {Promise<string>} The name of the stack.
 */
export async function fetchStackDetails(stackId: string): Promise<string> {
  const zenmlClient = ZenMLClient.getInstance();
  const response = await zenmlClient.request('get', `/stacks/${stackId}`);
  if (response && response.name) {
    return response.name;
  } else {
    throw new Error('Failed to fetch stack details');
  }
}

/**
 * Switches the active ZenML stack to the specified stack name.
 *
 * @param {string} stackId - The id of the ZenML stack to be activated.
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the newly activated stack, or undefined on error.
 */
export async function switchZenMLStack(
  stackId: string
): Promise<{ id: string; name: string } | undefined> {
  const shell = new Shell();
  try {
    const result = await shell.runPythonScript('src/commands/stack/operations.py', [
      'set_active_stack',
      stackId,
    ]);

    const { id, name } = result;
    vscode.window.showInformationMessage(`Active stack set to: ${name}`);
    await storeActiveStack(id, name);
    return { id, name };
  } catch (error) {
    console.error(`Error setting active stack: ${error}`);
    vscode.window.showErrorMessage(`Failed to set active stack: ${error}`);
  }
}

/**
 * Retrieves the currently active ZenML stack. If the active stack is stored in the global configuration,
 * it uses that information. Otherwise, it fetches the active stack using a Python script.
 *
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the active stack, or undefined on error;
 */
export async function getActiveStack(): Promise<{ id: string; name: string } | undefined> {
  const config = vscode.workspace.getConfiguration('zenml');
  const storedId = config.get<string>('activeStackId');
  const storedName = config.get<string>('activeStackName');

  if (storedId && storedName) {
    return { id: storedId, name: storedName };
  }

  const shell = new Shell();
  try {
    const result = await shell.runPythonScript('src/commands/stack/operations.py', [
      'get_active_stack',
    ]);

    const { id, name } = result;

    if (id && name) {
      await storeActiveStack(id, name);
      vscode.window.showInformationMessage(`The global active stack is: ${name}`);
      return { id, name };
    } else {
      vscode.window.showErrorMessage('Failed to retrieve the active ZenML stack information.');
    }
  } catch (error) {
    console.error(`Error getting active stack information: ${error}`);
    vscode.window.showErrorMessage(`Failed to get active stack information: ${error}`);
  }
}

/**
 * Stores the specified ZenML stack id and name in the global configuration.
 *
 * @param {string} id - The id of the ZenML stack to be stored.
 * @param {string} name - The name of the ZenML stack to be stored.
 * @returns {Promise<void>} A promise that resolves when the stack information has been successfully stored.
 */
export async function storeActiveStack(id: string, name: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('zenml');
  await config.update('activeStackId', id, vscode.ConfigurationTarget.Global);
  await config.update('activeStackName', name, vscode.ConfigurationTarget.Global);
}
