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
import { ArrayXY, PointArrayAlias, SVG, SvgType, registerWindow } from '@svgdotjs/svg.js';

import { LSClient } from '../../services/LSClient';
import { showErrorMessage, showInformationMessage } from '../../utils/notifications';
import { PipelineTreeItem } from '../../views/activityBar';
import { PipelineDataProvider } from '../../views/activityBar/pipelineView/PipelineDataProvider';
import * as vscode from 'vscode';
import {
  getPipelineRunDashboardUrl,
  getDagPanel,
  getLoadingContent,
  registerDagPanel,
  getDagData,
  layoutDag,
  drawDag,
  getWebviewContent,
  LocalDatabaseError,
} from './utils';
import { getPath } from '../../utils/global';
import { DagResp } from '../../types/PipelineTypes';

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
          showInformationMessage('Pipeline run deleted successfully.');
          await refreshPipelineView();
        } catch (error: any) {
          console.error(`Error deleting pipeline run: ${error}`);
          showErrorMessage(`Failed to delete pipeline run: ${error.message}`);
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
      vscode.window.showInformationMessage(`Opening: ${url}`);
    } catch (error) {
      console.log(error);
      vscode.window.showErrorMessage(`Failed to open pipeline run URL: ${error}`);
    }
  }
};

const renderDag = async (node: PipelineTreeItem): Promise<void> => {
  // if DAG has already been rendered, switch to that panel
  const existingPanel = getDagPanel(node.id);
  if (existingPanel) {
    existingPanel.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    `DAG-${node.id}`,
    `DAG Visualization`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  panel.webview.html = getLoadingContent();

  let dagData: DagResp;
  try {
    dagData = await getDagData(node.id);
  } catch (e) {
    if (e instanceof LocalDatabaseError) {
      vscode.window.showInformationMessage('Zenml must be connected to a server to visualize DAG');
    } else {
      vscode.window.showErrorMessage('Unable to receive response from Zenml server');
    }

    return;
  }

  const graph = layoutDag(dagData);

  const svg = await drawDag(dagData.nodes, graph, panel);

  const onDiskPath = vscode.Uri.file(getPath() + '/resources/dag-view/dag.css');
  const cssUri = panel.webview.asWebviewUri(onDiskPath).toString();

  // And set its HTML content
  panel.webview.html = getWebviewContent({ svg, cssUri });

  // To track which DAGs are currently open
  registerDagPanel(node.id, panel);
};

export const pipelineCommands = {
  refreshPipelineView,
  deletePipelineRun,
  goToPipelineUrl,
  renderDag,
};
