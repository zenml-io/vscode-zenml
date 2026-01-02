// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and limitations under the License.

import * as vscode from 'vscode';
import { EventBus } from '../../services/EventBus';
import { LSClient } from '../../services/LSClient';
import {
  GetActiveProjectResponse,
  SetActiveProjectResponse,
} from '../../types/LSClientResponseTypes';
import { Project } from '../../types/ProjectTypes';
import { LSP_ZENML_PROJECT_CHANGED } from '../../utils/constants';
import { ServerDataProvider } from '../../views/activityBar';
import { buildWorkspaceProjectUrl, getBaseUrl, isServerStatus } from '../server/utils';

/**
 * Helper function to update the active project name in settings.
 * It attempts an immediate update and, on failure, retries after a delay.
 *
 * @param {string} projectName - The project name to store.
 * @param {number} delay - Delay (in ms) before attempting the update.
 * @param {number} retries - Number of retry attempts if the update fails.
 */
async function updateActiveProjectInSettings(
  projectName: string,
  delay: number = 0,
  retries: number = 1
): Promise<void> {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  try {
    const config = vscode.workspace.getConfiguration('zenml');
    await config.update('activeProjectName', projectName, vscode.ConfigurationTarget.Global);
    console.log(`Successfully stored active project: ${projectName}`);
  } catch (error) {
    console.error(`Failed to store active project in settings: ${error}`);
    if (retries > 0) {
      // Retry after a 500ms delay.
      await updateActiveProjectInSettings(projectName, 500, retries - 1);
    }
  }
}

/**
 * Sets the active project and emits an event for the project change.
 *
 * @param {string} projectName - The name of the project to set as active.
 * @returns {Promise<Project | undefined>} - A promise that resolves to the project.
 */
export async function switchActiveProject(projectName: string): Promise<Project | undefined> {
  const lsClient = LSClient.getInstance();
  const result = await lsClient.sendLsClientRequest<SetActiveProjectResponse>('setActiveProject', [
    projectName,
  ]);

  if (result && !('error' in result)) {
    updateActiveProjectInSettings(projectName).catch(() => {
      // any error is already logged; we don't want to block event emission
    });
    // emit the project-changed event regardless of config update success
    EventBus.getInstance().emit(LSP_ZENML_PROJECT_CHANGED, projectName);
    return result;
  }
  return undefined;
}

/**
 * Gets the id and name of the active ZenML project.
 *
 * @returns {Promise<{id: string, name: string}>} A promise that resolves with the id and name of the active project, or undefined on error.
 */
export const getActiveProject = async (): Promise<{ id: string; name: string } | undefined> => {
  const lsClient = LSClient.getInstance();
  if (!lsClient.clientReady) {
    return;
  }

  try {
    const result = await lsClient.sendLsClientRequest<GetActiveProjectResponse>('getActiveProject');
    if (result && 'error' in result) {
      throw new Error(result.error);
    }
    return result;
  } catch (error: any) {
    console.error(`Failed to get active project information: ${error}`);
    return undefined;
  }
};

/**
 * Stores the specified ZenML project name in the global configuration.
 *
 * @param {string} projectName - The name of the ZenML project to be stored.
 * @returns {Promise<void>} A promise that resolves when the project information has been successfully stored.
 */
export const storeActiveProject = async (projectName: string): Promise<void> => {
  await updateActiveProjectInSettings(projectName);
};

/**
 * Gets the active project name from the global configuration.
 *
 * @returns {string | undefined} The active project name.
 */
export const getActiveProjectNameFromConfig = (): string | undefined => {
  const config = vscode.workspace.getConfiguration('zenml');
  return config.get<string>('activeProjectName');
};

/**
 * Constructs the dashboard URL for a project.
 *
 * @param {string} projectName - The name of the project.
 * @returns {string} - The dashboard URL for the project.
 */
export function getProjectDashboardUrl(projectName: string): string {
  if (!projectName) {
    return '';
  }

  const serverStatus = ServerDataProvider.getInstance().getCurrentStatus();

  if (!isServerStatus(serverStatus) || serverStatus.deployment_type === 'other') {
    return '';
  }

  const baseUrl = getBaseUrl(serverStatus.dashboard_url);
  const suffix = `/projects/${projectName}/pipelines`;
  return buildWorkspaceProjectUrl(baseUrl, serverStatus, suffix);
}

export const projectUtils = {
  switchActiveProject,
  getActiveProject,
  storeActiveProject,
  getActiveProjectNameFromConfig,
  getProjectDashboardUrl,
};
