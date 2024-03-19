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
import { RestZenServerStoreConfig, ZenServerStoreConfig } from '../types/ServerInfoTypes';
import { PYTOOL_MODULE } from './constants';

/**
 * Resets the ZenML Server URL and access token in the VSCode workspace configuration.
 */
export const resetGlobalConfiguration = async () => {
  const config = vscode.workspace.getConfiguration('zenml');
  await config.update('serverUrl', '', vscode.ConfigurationTarget.Global);
  await config.update('accessToken', '', vscode.ConfigurationTarget.Global);
};

/**
 * Retrieves the ZenML Server URL from the VSCode workspace configuration.
 */
export const getZenMLServerUrl = (): string => {
  const config = vscode.workspace.getConfiguration('zenml');
  return config.get<string>('serverUrl') || '';
};

/**
 * Retrieves the ZenML access token from the VSCode workspace configuration.
 */
export const getZenMLAccessToken = (): string => {
  const config = vscode.workspace.getConfiguration('zenml');
  return config.get<string>('accessToken') || '';
};

/**
 * Updates the ZenML Server URL and access token in the VSCode workspace configuration.
 *
 * @param {ZenServerStoreConfig} storeConfig - The new ZenML Server configuration to be updated.
 * @returns {Promise<void>} A promise that resolves after the configuration has been updated.
 */
export const updateServerUrlAndToken = async (
  storeConfig: ZenServerStoreConfig | undefined
): Promise<void> => {
  let accessToken: string | undefined;
  const serverUrl = storeConfig?.url;
  if (storeConfig && storeConfig.type === 'rest' && storeConfig.url.startsWith('http:')) {
    accessToken = (storeConfig as RestZenServerStoreConfig).api_token;
  }

  const config = vscode.workspace.getConfiguration('zenml');

  try {
    await config.update('serverUrl', serverUrl, vscode.ConfigurationTarget.Global);
    await config.update('accessToken', accessToken, vscode.ConfigurationTarget.Global);
    console.log('ZenML Server URL and access token have been updated successfully.');
  } catch (error: any) {
    console.error(`Failed to update ZenML configuration: ${error.message}`);
    throw new Error('Failed to update ZenML Server URL and access token.');
  }
};

/**
 * Updates the ZenML Server URL in the VSCode workspace configuration.
 *
 * @param {string} serverUrl - The new ZenML Server URL to be updated. Pass an empty string if you want to clear it.
 */
export const updateServerUrl = async (serverUrl: string): Promise<void> => {
  const config = vscode.workspace.getConfiguration('zenml');
  try {
    await config.update('serverUrl', serverUrl, vscode.ConfigurationTarget.Global);
    console.log('ZenML Server URL has been updated successfully.');
  } catch (error: any) {
    console.error(`Failed to update ZenML configuration: ${error.message}`);
    throw new Error('Failed to update ZenML Server URL.');
  }
};

/**
 * Updates the ZenML access token in the VSCode workspace configuration.
 *
 * @param {string} accessToken - The new access token to be updated. Pass an empty string if you want to clear it.
 */
export const updateAccessToken = async (accessToken: string): Promise<void> => {
  const config = vscode.workspace.getConfiguration('zenml');
  try {
    await config.update('accessToken', accessToken, vscode.ConfigurationTarget.Global);
    console.log('ZenML access token has been updated successfully.');
  } catch (error: any) {
    console.error(`Failed to update ZenML configuration: ${error.message}`);
    throw new Error('Failed to update ZenML access token.');
  }
};

/**
 * Updates the default Python interpreter path globally.
 * @param interpreterPath The new default Python interpreter path.
 */
export async function updateDefaultPythonInterpreterPath(interpreterPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('python');
  await config.update('defaultInterpreterPath', interpreterPath, vscode.ConfigurationTarget.Global);
}

/**
 * Updates the ZenML Python interpreter setting.
 * @param interpreterPath The new path to the python environminterpreterent.
 */
export async function updatePytoolInterpreter(interpreterPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(PYTOOL_MODULE);
  await config.update('interpreter', [interpreterPath], vscode.ConfigurationTarget.Workspace);
}

/**
 * Retrieves the virtual environment path from the VSCode workspace configuration.
 * @returns The path to the virtual environment.
 */
export function getDefaultPythonInterpreterPath(): string {
  const config = vscode.workspace.getConfiguration('python');
  const defaultInterpreterPath = config.get<string>('defaultInterpreterPath', '');
  return defaultInterpreterPath;
}
