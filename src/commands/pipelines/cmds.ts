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
import Dagre from 'dagre';

import { LSClient } from '../../services/LSClient';
import { showErrorMessage, showInformationMessage } from '../../utils/notifications';
import { PipelineTreeItem } from '../../views/activityBar';
import { PipelineDataProvider } from '../../views/activityBar/pipelineView/PipelineDataProvider';
import * as vscode from 'vscode';
import { getPipelineRunDashboardUrl } from './utils';
import { getZenMLAccessToken, getZenMLServerUrl } from '../../utils/global';
import { DagResp } from '../../types/PipelineTypes';

let openPanels: vscode.WebviewPanel[] = [];

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
  const existingPanel = openPanels.find(p => p.viewType === `DAG-${node.id}`);
  if (existingPanel) {
    existingPanel.reveal();
    return;
  }

  const token = getZenMLAccessToken();
  const server = getZenMLServerUrl();
  const pathToApi = `/api/v1/runs/${node.id}/graph`;
  console.log(node.id);

  const { createSVGWindow } = await import('svgdom');

  const response = await fetch(server + pathToApi, {
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });

  const { edges, nodes } = (await response.json()) as DagResp;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 35, nodesep: 5 });

  edges.forEach(edge => g.setEdge(edge.source, edge.target));
  nodes.forEach(node => g.setNode(node.id, { width: 300, height: node.type === 'step' ? 50 : 44 }));

  Dagre.layout(g);

  const window = createSVGWindow();
  const document = window.document;

  registerWindow(window, document);
  const canvas = SVG().addTo(document.documentElement);
  canvas.size(g.graph().width, g.graph().height);

  g.edges().forEach(edge => {
    // console.log(edge, g.node(edge.v));
    const line: ArrayXY[] = g.edge(edge).points.map(({ x, y }) => [x, y]);
    canvas
      .polyline(line)
      .fill('none')
      .stroke({ color: '#f06', width: 4, linecap: 'round', linejoin: 'round' });
  });

  nodes.forEach(node => {
    const { width, height, x, y } = g.node(node.id);
    const group = canvas
      .group()
      .translate(x - width / 2, y - height / 2)
      .attr('data-id', node.id);
    if (node.type === 'step') {
      group.rect(width, height).fill('white').stroke({ color: 'black', width: 2 });
    } else {
      group.rect(width, height).radius(20).fill('orange').stroke({ color: 'red', width: 2 });
    }
    const label = group.text(node.data.name);
    label.center(width / 2, height / 2);
  });

  const panel = vscode.window.createWebviewPanel(
    `DAG-${node.id}`,
    `DAG Visualization`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // And set its HTML content
  panel.webview.html = getWebviewContent(canvas.svg());

  // To track which DAGs are currently open
  openPanels.push(panel);

  panel.onDidDispose(() => {
    openPanels = openPanels.filter(p => p !== panel);
  }, null);
};

function getWebviewContent(svg: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Coding</title>
</head>
<body>
    ${svg}
</body>
</html>`;
}

export const pipelineCommands = {
  refreshPipelineView,
  deletePipelineRun,
  goToPipelineUrl,
  renderDag,
};
