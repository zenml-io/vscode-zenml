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
 * @param {string} url - The new ZenML Server URL to be updated.
 * @param {string} token - The new access token to be updated.
 * @returns {Promise<void>} A promise that resolves after the configuration has been updated.
 */
export const updateServerUrlAndToken = async (url: string, token: string): Promise<void> => {
  try {
    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('serverUrl', url, vscode.ConfigurationTarget.Global);
    await config.update('accessToken', token, vscode.ConfigurationTarget.Global);
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

/**
 * Toggles the registration of commands for the extension.
 *
 * @param state The state to set the commands to.
 */
export async function toggleCommands(state: boolean): Promise<void> {
  await vscode.commands.executeCommand('setContext', 'stackCommandsRegistered', state);
  await vscode.commands.executeCommand('setContext', 'componentCommandsRegistered', state);
  await vscode.commands.executeCommand('setContext', 'serverCommandsRegistered', state);
  await vscode.commands.executeCommand('setContext', 'pipelineCommandsRegistered', state);
  await vscode.commands.executeCommand('setContext', 'environmentCommandsRegistered', state);
  await vscode.commands.executeCommand('setContext', 'projectCommandsRegistered', state);
}

/**
 * Retrieves the ZenML analytics enabled setting.
 * @returns Whether analytics are enabled in ZenML settings.
 */
export const getZenMLAnalyticsEnabled = (): boolean => {
  const config = vscode.workspace.getConfiguration('zenml');
  return config.get<boolean>('analyticsEnabled', true);
};

/**
 * Updates the ZenML analytics enabled setting.
 * @param enabled Whether to enable analytics.
 */
export const updateZenMLAnalyticsEnabled = async (enabled: boolean): Promise<void> => {
  const config = vscode.workspace.getConfiguration('zenml');
  await config.update('analyticsEnabled', enabled, vscode.ConfigurationTarget.Global);
};

/**
 * Server URL connection type for privacy-safe analytics.
 */
export type ServerConnectionType = 'local' | 'cloud' | 'remote' | 'unknown';

/**
 * Categorizes a server URL into a privacy-safe connection type.
 * This function is exported for testability.
 *
 * @param url The server URL to categorize
 * @returns A privacy-safe category: 'local', 'cloud', 'remote', or 'unknown'
 */
/**
 * Checks if a hostname is in the 172.16.0.0/12 private range (172.16.0.0 - 172.31.255.255).
 */
const isIn172PrivateRange = (hostname: string): boolean => {
  const match = hostname.match(/^172\.(\d+)\./);
  if (!match) {
    return false;
  }
  const secondOctet = parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
};

export const categorizeServerUrl = (url?: string): ServerConnectionType => {
  if (!url) {
    return 'unknown';
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check for local/private addresses:
    // - localhost and common loopback addresses
    // - IPv6 loopback (::1)
    // - 10.0.0.0/8 private range
    // - 172.16.0.0/12 private range (172.16.x.x - 172.31.x.x)
    // - 192.168.0.0/16 private range
    // - .local mDNS domain
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      isIn172PrivateRange(hostname) ||
      hostname.endsWith('.local')
    ) {
      return 'local';
    }

    if (hostname.includes('zenml.io') || hostname.includes('cloudapi.zenml')) {
      return 'cloud';
    }

    return 'remote';
  } catch {
    return 'unknown';
  }
};
