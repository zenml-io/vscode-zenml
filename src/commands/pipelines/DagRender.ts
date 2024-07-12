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
import fs from 'fs/promises';
import * as vscode from 'vscode';
import * as Dagre from 'dagre';
import { ArrayXY, SVG, registerWindow } from '@svgdotjs/svg.js';
import { PipelineTreeItem, ServerDataProvider } from '../../views/activityBar';
import { DagResp, DagNode } from '../../types/PipelineTypes';
import { LSClient } from '../../services/LSClient';
import { ServerStatus } from '../../types/ServerInfoTypes';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';
import { PanelDataProvider } from '../../views/panel/panelView/PanelDataProvider';

interface Edge {
  from: string;
  points: ArrayXY[];
}

export default class DagRenderer {
  private static instance: DagRenderer | undefined;
  private openPanels: { [id: string]: vscode.WebviewPanel };
  private extensionPath: string;
  private createSVGWindow: Function = () => {};
  private iconSvgs: { [name: string]: string } = {};

  constructor(context: vscode.ExtensionContext) {
    DagRenderer.instance = this;
    this.openPanels = {};
    this.extensionPath = context.extensionPath;
    this.loadSvgWindowLib();
    this.loadIcons();
  }
  /**
   * Retrieves a singleton instance of DagRenderer
   *
   * @returns {DagRenderer | undefined} The singleton instance if it exists
   */
  public static getInstance(): DagRenderer | undefined {
    return DagRenderer.instance;
  }

  /**
   * Used to remove DagRenderer WebviewPanels when the extension is deactivated.
   */
  public deactivate(): void {
    DagRenderer.instance = undefined;
    Object.values<vscode.WebviewPanel>(this.openPanels).forEach(panel => panel.dispose());
  }

  /**
   * Renders DAG Visualization for a piepline run into Webview Panel
   * @param node The Pipeline run to render
   * @returns
   */
  public async createView(node: PipelineTreeItem) {
    const existingPanel = this.getDagPanel(node.id);
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      `DAG-${node.id}`,
      node.label as string,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );
    const status = ServerDataProvider.getInstance().getCurrentStatus() as ServerStatus;
    const dashboardUrl = status.dashboard_url;
    const deploymentType = status.deployment_type;
    const runUrl = deploymentType === 'other' ? '' : `${dashboardUrl}/runs/${node.id}?tab=overview`;

    panel.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'update':
          this.renderDag(panel, node);
          break;

        case 'step':
          const stepData = await LSClient.getInstance().sendLsClientRequest<JsonObject>(
            'getPipelineRunStep',
            [message.id]
          );
          PanelDataProvider.getInstance().setData(
            { runUrl, ...stepData },
            'Pipeline Run Step Data'
          );
          vscode.commands.executeCommand('zenmlPanelView.focus');
          break;

        case 'artifact':
          const artifactData = await LSClient.getInstance().sendLsClientRequest<JsonObject>(
            'getPipelineRunArtifact',
            [message.id]
          );
          if (deploymentType === 'cloud') {
            const artifactUrl = `${dashboardUrl}/artifact-versions/${message.id}?tab=overview`;
            PanelDataProvider.getInstance().setData(
              { artifactUrl, ...artifactData },
              'Artifact Version Data'
            );
          } else {
            PanelDataProvider.getInstance().setData(
              { runUrl, ...artifactData },
              'Artifact Version Data'
            );
          }

          vscode.commands.executeCommand('zenmlPanelView.focus');
          break;

        case 'artifactUrl':
          if (deploymentType === 'cloud') {
            const uri = vscode.Uri.parse(
              `${dashboardUrl}/artifact-versions/${message.id}?tab=overview`
            );
            vscode.env.openExternal(uri);
            break;
          }

        case 'stepUrl':
          const uri = vscode.Uri.parse(runUrl);
          vscode.env.openExternal(uri);
          break;
      }
    }, undefined);

    this.renderDag(panel, node);

    // To track which DAGs are currently open
    this.registerDagPanel(node.id, panel);
  }

  private async renderDag(panel: vscode.WebviewPanel, node: PipelineTreeItem) {
    panel.webview.html = this.getLoadingContent();

    const client = LSClient.getInstance();

    let dagData: DagResp;
    try {
      dagData = await client.sendLsClientRequest<DagResp>('getPipelineRunDag', [node.id]);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to receive response from Zenml server: ${e}`);
      return;
    }

    const graph = this.layoutDag(dagData);

    const svg = await this.drawDag(dagData.nodes, graph, panel);

    const cssOnDiskPath = vscode.Uri.file(this.extensionPath + '/resources/dag-view/dag.css');
    const cssUri = panel.webview.asWebviewUri(cssOnDiskPath).toString();

    const jsOnDiskPath = vscode.Uri.file(this.extensionPath + '/resources/dag-view/dag.js');
    const jsUri = panel.webview.asWebviewUri(jsOnDiskPath).toString();

    const updateButton = dagData.status === 'running' || dagData.status === 'initializing';
    const title = `${dagData.name} - v${dagData.version}`;

    // And set its HTML content
    panel.webview.html = this.getWebviewContent({ svg, cssUri, jsUri, updateButton, title });
  }

  private async loadSvgWindowLib() {
    const { createSVGWindow } = await import('svgdom');
    this.createSVGWindow = createSVGWindow;
  }

  private deregisterDagPanel(runId: string) {
    delete this.openPanels[runId];
  }

  private getDagPanel(runId: string): vscode.WebviewPanel | undefined {
    return this.openPanels[runId];
  }

  private registerDagPanel(runId: string, panel: vscode.WebviewPanel) {
    this.openPanels[runId] = panel;

    panel.onDidDispose(() => {
      this.deregisterDagPanel(runId);
    }, null);
  }

  private layoutDag(dagData: DagResp): Dagre.graphlib.Graph {
    const { nodes, edges } = dagData;
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', ranksep: 35, nodesep: 5 });

    edges.forEach(edge => g.setEdge(edge.source, edge.target));
    nodes.forEach(node =>
      g.setNode(node.id, { width: 300, height: node.type === 'step' ? 50 : 44 })
    );

    Dagre.layout(g);
    return g;
  }

  private loadIcons(): void {
    const ICON_MAP = {
      failed: 'alert.svg',
      completed: 'check.svg',
      cached: 'cached.svg',
      initializing: 'initializing.svg',
      running: 'play.svg',
      database: 'database.svg',
      dataflow: 'dataflow.svg',
    };
    const basePath = `${this.extensionPath}/resources/dag-view/icons/`;
    Object.entries(ICON_MAP).forEach(async ([name, fileName]) => {
      try {
        const file = await fs.readFile(basePath + fileName);
        this.iconSvgs[name] = file.toString();
      } catch {
        this.iconSvgs[name] = '';
      }
    });
  }

  private calculateEdges = (g: Dagre.graphlib.Graph): Array<Edge> => {
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

  private async drawDag(
    nodes: Array<DagNode>,
    graph: Dagre.graphlib.Graph,
    panel: vscode.WebviewPanel
  ): Promise<string> {
    // const uris = this.getIconUris(panel);
    const window = this.createSVGWindow();
    const document = window.document;

    registerWindow(window, document);
    const canvas = SVG().addTo(document.documentElement).id('dag');
    canvas.size(graph.graph().width, graph.graph().height);
    const orthoEdges = this.calculateEdges(graph);

    const edgeGroup = canvas.group().attr('id', 'edges');

    orthoEdges.forEach(edge => {
      edgeGroup
        .polyline(edge.points)
        .fill('none')
        .stroke({ width: 2, linecap: 'round', linejoin: 'round' })
        .attr('data-from', edge.from);
    });

    const nodesGroup = canvas.group().attr('id', 'nodes');

    nodes.forEach(node => {
      const { width, height, x, y } = graph.node(node.id);
      let iconSVG: string;
      let status: string = '';
      const executionId = { attr: '', value: node.data.execution_id };

      if (node.type === 'step') {
        iconSVG = this.iconSvgs[node.data.status];
        status = node.data.status;
        executionId.attr = 'data-stepid';
      } else {
        executionId.attr = 'data-artifactid';
        if (node.data.artifact_type === 'ModelArtifact') {
          iconSVG = this.iconSvgs.dataflow;
        } else {
          iconSVG = this.iconSvgs.database;
        }
      }

      const container = nodesGroup
        .foreignObject(width, height)
        .translate(x - width / 2, y - height / 2);

      const div = container.element('div').attr('class', 'node').attr('data-id', node.id);
      const box = div
        .element('div')
        .attr('class', node.type)
        .attr(executionId.attr, executionId.value);
      const icon = SVG(iconSVG);
      box.add(SVG(icon).attr('class', `icon ${status}`));
      box.element('p').words(node.data.name);
    });
    return canvas.svg();
  }

  private getLoadingContent(): string {
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
</html>`;
  }

  private getWebviewContent({
    svg,
    cssUri,
    jsUri,
    updateButton,
    title,
  }: {
    svg: string;
    cssUri: string;
    jsUri: string;
    updateButton: boolean;
    title: string;
  }): string {
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
    <div id="update" ${updateButton ? 'class="needs-update"' : ''}>
      <p>${title}</p>${updateButton ? '<button>click to update</button>' : ''}
    </div>
  <div id="container">
    ${svg}
  </div>
  <script src="${jsUri}"></script>
</body>
</html>`;
  }
}
