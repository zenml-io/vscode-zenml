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

export class LocalDatabaseError extends Error {}

export const getDagData = async (runId: string): Promise<DagResp> => {
  const server = getZenMLServerUrl();

  if (server.startsWith('sqlite')) {
    throw new LocalDatabaseError();
  }
  const token = getZenMLAccessToken();
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

interface Edge {
  from: string;
  points: ArrayXY[];
}

const calculateEdges = (g: Dagre.graphlib.Graph): Array<Edge> => {
  const edges = g.edges();
  return edges.map(edge => {
    const currentLine = g.edge(edge).points.map<ArrayXY>(point => [point.x, point.y]);
    const startNode = g.node(edge.v);
    const endNode = g.node(edge.w);

    const rest = currentLine.slice(1, currentLine.length - 1);
    const start = [startNode.x, startNode.y + startNode.height / 2];
    const end = [endNode.x, endNode.y - endNode.height / 2];
    const second = [startNode.x, rest[0][1]];
    const penultimate = [endNode.x, rest[rest.length - 1][1]];

    return {
      from: edge.v,
      points: [start, second, ...rest, penultimate, end] as ArrayXY[],
    };
  });
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
  const canvas = SVG().addTo(document.documentElement).id('dag');
  canvas.size(graph.graph().width, graph.graph().height);
  const orthoEdges = calculateEdges(graph);

  const edgeGroup = canvas.group().attr('id', 'edges');

  orthoEdges.forEach(edge => {
    edgeGroup
      .polyline(edge.points)
      .fill('none')
      .stroke({ width: 2, linecap: 'round', linejoin: 'round' })
      .attr('data-from', edge.from);
  });

  // graph.edges().forEach(edge => {
  //   // console.log(edge, g.node(edge.v));
  //   const line: ArrayXY[] = graph.edge(edge).points.map(({ x, y }) => [x, y]);
  //   edgeGroup.polyline(line).fill('none').stroke({ width: 2, linecap: 'round', linejoin: 'round' });
  // });

  const nodesGroup = canvas.group().attr('id', 'nodes');

  nodes.forEach(node => {
    const { width, height, x, y } = graph.node(node.id);
    const iconUri = uris.get(node);

    const container = nodesGroup
      .foreignObject(width, height)
      .translate(x - width / 2, y - height / 2);

    const div = container.element('div').attr('class', 'node').attr('data-id', node.id);
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
  return canvas.svg();
};

export const getWebviewContent = ({
  svg,
  cssUri,
  jsUri,
}: {
  svg: string;
  cssUri: string;
  jsUri: string;
}): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${cssUri}">
  <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.5.0/dist/svg-pan-zoom.min.js"></script>
    <title>DAG</title>
</head>
<body>
  <div id="container">
    ${svg}
  </div>
  <script src="${jsUri}"></script>
</body>
</html>`;
};

export const getLoadingContent = () => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loading</title>
        <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; }
            .spinner {
                border: 8px solid #f3f3f3;
                border-top: 8px solid #3498db;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                animation: spin 2s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="spinner"></div>
    </body>
    </html>
    `;
};

const pipelineUtils = {
  getPipelineRunDashboardUrl,
  getDagPanel,
  getLoadingContent,
  registerDagPanel,
};

export default pipelineUtils;
