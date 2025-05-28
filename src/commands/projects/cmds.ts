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
import { EventBus } from '../../services/EventBus';
import { LSP_ZENML_PROJECT_CHANGED } from '../../utils/constants';
import { ProjectDataProvider } from '../../views/activityBar/projectView/ProjectDataProvider';
import { ProjectTreeItem } from '../../views/activityBar/projectView/ProjectTreeItems';
import { getProjectDashboardUrl, switchActiveProject } from './utils';

/**
 * Refreshes the project view.
 */
const refreshProjectView = async () => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
    },
    async () => {
      await ProjectDataProvider.getInstance().refresh();
    }
  );
};

/**
 * Sets the selected project as the active project and stores it in the global context.
 *
 * @param {ProjectTreeItem} node The project to activate.
 * @returns {Promise<void>} Resolves after setting the active project.
 */
const setActiveProject = async (node: ProjectTreeItem): Promise<void> => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Setting Active Project...',
      cancellable: false,
    },
    async () => {
      try {
        const result = await switchActiveProject(node.name);
        if (result) {
          EventBus.getInstance().emit(LSP_ZENML_PROJECT_CHANGED, node.name);
          vscode.window.showInformationMessage(`Active project set to: ${node.name}`);
        }
      } catch (error) {
        console.log(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to set active project: ${errorMessage}`);
      }
    }
  );
};

/**
 * Opens the selected project in the ZenML Dashboard in the browser
 *
 * @param {ProjectTreeItem} node The project to open.
 */
const goToProjectUrl = (node: ProjectTreeItem) => {
  const url = getProjectDashboardUrl(node.project.name);

  if (url) {
    try {
      const parsedUrl = vscode.Uri.parse(url);

      vscode.env.openExternal(parsedUrl);
    } catch (error) {
      console.log(error);
      vscode.window.showErrorMessage(`Failed to open project URL: ${error}`);
    }
  } else {
    vscode.window.showErrorMessage(`Could not determine URL for project: ${node.project.name}`);
  }
};

export const projectCommands = {
  refreshProjectView,
  setActiveProject,
  goToProjectUrl,
};
