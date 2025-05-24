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
import { PipelineTreeItem } from '../../views/activityBar';
import {
  createCommandErrorItem,
  createCommandSuccessItem,
} from '../../views/activityBar/common/ErrorTreeItem';
import { PipelineDataProvider } from '../../views/activityBar/pipelineView/PipelineDataProvider';
import DagRenderer from './DagRender';
import { getPipelineRunDashboardUrl } from './utils';

/**
 * Triggers a refresh of the pipeline view within the UI components.
 *
 * @returns {Promise<void>} Resolves after refreshing the view.
 */
const refreshPipelineView = async (): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
    },
    async () => {
      await PipelineDataProvider.getInstance().refresh();
    }
  );
};

/**
 * Deletes a pipeline run.
 *
 * @param {PipelineTreeItem} node The pipeline run to delete.
 * @returns {Promise<void>} Resolves after deleting the pipeline run.
 */
const deletePipelineRun = async (node: PipelineTreeItem): Promise<void> => {
  const userConfirmation = await vscode.window.showWarningMessage(
    'Are you sure you want to delete this pipeline run?',
    { modal: true },
    'Yes',
    'No'
  );

  if (userConfirmation === 'Yes') {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Deleting pipeline run...',
      },
      async () => {
        const runId = node.id;
        try {
          const lsClient = LSClient.getInstance();
          const result = await lsClient.sendLsClientRequest('deletePipelineRun', [runId]);
          if (result && 'error' in result) {
            throw new Error(result.error);
          }
          const pipelineProvider = PipelineDataProvider.getInstance();
          pipelineProvider.showCommandSuccess(
            createCommandSuccessItem('deleted pipeline run', 'Pipeline run deleted successfully')
          );
          await refreshPipelineView();
        } catch (error: any) {
          console.error(`Error deleting pipeline run: ${error}`);
          const pipelineProvider = PipelineDataProvider.getInstance();
          pipelineProvider.showCommandError(
            createCommandErrorItem(
              'delete pipeline run',
              `Failed to delete pipeline run: ${error.message}`
            )
          );
        }
      }
    );
  }
};

/**
 * Opens the selected pipieline run in the ZenML Dashboard in the browser
 *
 * @param {PipelineTreeItem} node The pipeline run to open.
 */
const goToPipelineUrl = (node: PipelineTreeItem): void => {
  const url = getPipelineRunDashboardUrl(node.id);

  if (url) {
    try {
      const parsedUrl = vscode.Uri.parse(url);

      vscode.env.openExternal(parsedUrl);
    } catch (error) {
      console.log(error);
      const pipelineProvider = PipelineDataProvider.getInstance();
      pipelineProvider.showCommandError(
        createCommandErrorItem('open pipeline URL', `Failed to open pipeline run URL: ${error}`)
      );
    }
  }
};

/**
 * Opens the selected pipeline run in a DAG visualizer Webview Panel
 *
 * @param {PipelineTreeItem} node The pipeline run to render.
 */
const renderDag = (node: PipelineTreeItem): void => {
  DagRenderer.getInstance()?.createView(node);
};

export const pipelineCommands = {
  refreshPipelineView,
  deletePipelineRun,
  goToPipelineUrl,
  renderDag,
};
