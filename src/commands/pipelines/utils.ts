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
import Dagre from 'dagre';

import { WebviewPanel, Uri } from 'vscode';
import { getPath, getZenMLAccessToken, getZenMLServerUrl } from '../../utils/global';
import { DagNode, DagResp } from '../../types/PipelineTypes';
import { ArrayXY, SVG, registerWindow } from '@svgdotjs/svg.js';

const openPanels: { [id: string]: WebviewPanel | undefined } = {};

/**
 * Gets the Dashboard URL for the corresponding ZenML pipeline run
 *
 * @param {string} id - The id of the ZenML pipeline run to be opened
 * @returns {string} - The URL corresponding to the pipeline run in the ZenML Dashboard
 */
export const getPipelineRunDashboardUrl = (id: string): string => {
  const PIPELINE_URL_STUB = 'SERVER_URL/workspaces/default/all-runs/PIPELINE_ID/dag';
  const currentServerUrl = getZenMLServerUrl();

  const pipelineUrl = PIPELINE_URL_STUB.replace('SERVER_URL', currentServerUrl).replace(
    'PIPELINE_ID',
    id
  );

  return pipelineUrl;
};

export const getDagPanel = (runId: string): WebviewPanel | undefined => {
  return openPanels[runId];
};

export const registerDagPanel = (runId: string, panel: WebviewPanel) => {
  openPanels[runId] = panel;

  panel.onDidDispose(() => {
    deregisterDagPanel(runId);
  }, null);
};

const deregisterDagPanel = (runId: string) => {
  delete openPanels[runId];
};

export const getDagData = async (runId: string): Promise<DagResp> => {
  const token = getZenMLAccessToken();
  const server = getZenMLServerUrl();
  const pathToApi = `/api/v1/runs/${runId}/graph`;

  const response = await fetch(server + pathToApi, {
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });

  return (await response.json()) as DagResp;
};

export const layoutDag = (dagData: DagResp): Dagre.graphlib.Graph => {
  const { nodes, edges } = dagData;
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 35, nodesep: 5 });

  edges.forEach(edge => g.setEdge(edge.source, edge.target));
  nodes.forEach(node => g.setNode(node.id, { width: 300, height: node.type === 'step' ? 50 : 44 }));

  Dagre.layout(g);
  return g;
};

interface IconUris {
  alert: string;
  cached: string;
  check: string;
  database: string;
  dataflow: string;
  get: (node: DagNode) => string;
}

const getIconUris = (panel: WebviewPanel): IconUris => {
  const uris = {
    get(node: DagNode): string {
      if (node.type === 'step') {
        switch (node.data.status) {
          case 'completed':
            return this.check;
          case 'failed':
            return this.alert;
          case 'cached':
            return this.cached;
          default:
            return this.alert;
        }
      }

      if (node.data.artifact_type === 'ModelArtifact') {
        return this.dataflow;
      }

      return this.database;
    },
  } as IconUris;
  const keys: Array<Exclude<keyof IconUris, 'get'>> = [
    'alert',
    'cached',
    'check',
    'database',
    'dataflow',
  ];

  keys.forEach(key => {
    const uri = Uri.file(`${getPath()}/resources/dag-view/icons/${key}.svg`);
    uris[key] = panel.webview.asWebviewUri(uri).toString();
  });

  return uris;
};

export const drawDag = async (
  nodes: Array<DagNode>,
  graph: Dagre.graphlib.Graph,
  panel: WebviewPanel
): Promise<string> => {
  const uris = getIconUris(panel);
  const { createSVGWindow } = await import('svgdom');
  const window = createSVGWindow();
  const document = window.document;

  registerWindow(window, document);
  const canvas = SVG().addTo(document.documentElement);
  canvas.size(graph.graph().width, graph.graph().height);

  const edgeGroup = canvas.group().attr('id', 'edges');

  graph.edges().forEach(edge => {
    // console.log(edge, g.node(edge.v));
    const line: ArrayXY[] = graph.edge(edge).points.map(({ x, y }) => [x, y]);
    edgeGroup.polyline(line).fill('none').stroke({ width: 2, linecap: 'round', linejoin: 'round' });
  });

  const nodesGroup = canvas.group().attr('id', 'nodes');

  nodes.forEach(node => {
    const { width, height, x, y } = graph.node(node.id);
    const iconUri = uris.get(node);

    const container = nodesGroup
      .foreignObject(width, height)
      .translate(x - width / 2, y - height / 2);

    const div = container.element('div').attr('class', 'node');
    const box = div.element('div').attr('class', node.type);
    box.element('img').attr('src', iconUri);
    box.element('p').words(node.data.name);
    // const group = nodesGroup
    //   .group()
    //   .translate(x - width / 2, y - height / 2)
    //   .attr('data-id', node.id)
    //   .attr('class', 'node ' + node.type);
    // if (node.type === 'step') {
    //   group.rect(width, height).fill('white').stroke({ color: 'black', width: 2 });
    // } else {
    //   group.rect(width, height).fill('orange').stroke({ color: 'red', width: 2 });
    // }
    // const label = group.text(node.data.name);
    // label.center(width / 2, height / 2);
  });

  console.log(canvas.svg());

  return canvas.svg();
};

export const getWebviewContent = ({ svg, cssUri }: { svg: string; cssUri: string }): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${cssUri}">
    <title>Cat Coding</title>
</head>
<body>
  <div id="container">
    ${svg}
  </div>
  <script>
  //   const container = document.getElementById('container');
  //   const nodes = document.getElementById('nodes');
  //   container.append(nodes);
  </script>
</body>
</html>`;
};

const pipelineUtils = {
  getPipelineRunDashboardUrl,
  getDagPanel,
  registerDagPanel,
};

export default pipelineUtils;
