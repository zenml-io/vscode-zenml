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
import { LSClient } from '../../services/LSClient';
import { GenericLSClientResponse } from '../../types/LSClientResponseTypes';
import { PYTOOL_MODULE } from '../../utils/constants';
import { showErrorMessage, showInformationMessage } from '../../utils/notifications';
import { PipelineTreeItem } from '../../views/activityBar';
import { PipelineDataProvider } from '../../views/activityBar/pipelineView/PipelineDataProvider';
import * as vscode from 'vscode';

/**
 * Triggers a refresh of the pipeline view within the UI components.
 *
 * @returns {Promise<void>} Resolves after refreshing the view.
 */
const refreshPipelineView = async (): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Refreshing server status...',
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

  const lsClient = LSClient.getInstance().getLanguageClient();
  if (!lsClient) {
    console.log('Language server is not available.');
    return;
  }

  if (userConfirmation === 'Yes') {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Deleting pipeline run...',
      },
      async () => {
        const runId = node.id;
        try {
          const result: GenericLSClientResponse = await lsClient.sendRequest(
            'workspace/executeCommand',
            {
              command: `${PYTOOL_MODULE}.deletePipelineRun`,
              arguments: [runId],
            }
          );

          if ('error' in result && result.error) {
            throw new Error(result.error);
          }

          await refreshPipelineView();
          showInformationMessage('Pipeline run deleted successfully.');
        } catch (error: any) {
          console.error(`Error deleting pipeline run: ${error}`);
          showErrorMessage(`Failed to delete pipeline run: ${error.message}`);
        }
      }
    );
  }
};

export const pipelineCommands = {
  refreshPipelineView,
  deletePipelineRun,
};
