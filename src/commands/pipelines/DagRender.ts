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
import { PipelineRunDag, DagNode } from '../../types/PipelineTypes';
import { LSClient } from '../../services/LSClient';
import { ServerStatus } from '../../types/ServerInfoTypes';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';
import { PanelDataProvider } from '../../views/panel/panelView/PanelDataProvider';

const ROOT_PATH = ['resources', 'dag-view'];
const CSS_FILE = 'dag.css';
const JS_FILE = 'dag-packed.js';
const ICONS_DIRECTORY = '/resources/dag-view/icons/';

export default class DagRenderer {
  private static instance: DagRenderer | undefined;
  private openPanels: { [id: string]: vscode.WebviewPanel };
  private createSVGWindow: Function = () => {};
  private iconSvgs: { [name: string]: string } = {};
  private root: vscode.Uri;
  private javaScript: vscode.Uri;
  private css: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    DagRenderer.instance = this;
    this.openPanels = {};
    this.root = vscode.Uri.joinPath(context.extensionUri, ...ROOT_PATH);
    this.javaScript = vscode.Uri.joinPath(this.root, JS_FILE);
    this.css = vscode.Uri.joinPath(this.root, CSS_FILE);

    this.loadSvgWindowLib();
    this.loadIcons(context.extensionPath + ICONS_DIRECTORY);
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
        localResourceRoots: [this.root],
      }
    );

    panel.webview.html = this.getLoadingContent();

    panel.webview.onDidReceiveMessage(this.createMessageHandler(panel, node));

    this.renderDag(panel, node);

    // To track which DAGs are currently open
    this.registerDagPanel(node.id, panel);
  }

  private createMessageHandler(
    panel: vscode.WebviewPanel,
    node: PipelineTreeItem
  ): (message: { command: string; id: string }) => Promise<void> {
    const status = ServerDataProvider.getInstance().getCurrentStatus() as ServerStatus;
    const dashboardUrl = status.dashboard_url;
    const deploymentType = status.deployment_type;
    const runUrl = deploymentType === 'other' ? '' : `${dashboardUrl}/runs/${node.id}?tab=overview`;

    return async (message: { command: string; id: string }): Promise<void> => {
      switch (message.command) {
        case 'update':
          this.renderDag(panel, node);
          break;

        case 'step':
          this.loadStepDataIntoPanel(message.id, runUrl);
          break;

        case 'artifact': {
          this.loadArtifactDataIntoPanel(message.id, runUrl, dashboardUrl, deploymentType);
          break;
        }

        case 'artifactUrl':
          this.openArtifactUrl(message.id, dashboardUrl, deploymentType, runUrl);
          break;

        case 'stepUrl':
          this.openStepUrl(runUrl);
          break;
      }
    };
  }

  private async loadStepDataIntoPanel(id: string, runUrl: string): Promise<void> {
    const dataPanel = PanelDataProvider.getInstance();
    dataPanel.setLoading();

    const client = LSClient.getInstance();
    try {
      const stepData = await client.sendLsClientRequest<JsonObject>('getPipelineRunStep', [id]);

      dataPanel.setData({ runUrl, ...stepData }, 'Pipeline Run Step Data');
      vscode.commands.executeCommand('zenmlPanelView.focus');
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to retrieve step ${id}: ${e}`);
      console.error(e);
    }
  }

  private async loadArtifactDataIntoPanel(
    id: string,
    runUrl: string,
    dashboardUrl: string,
    deploymentType: string
  ) {
    const dataPanel = PanelDataProvider.getInstance();
    dataPanel.setLoading();

    const client = LSClient.getInstance();
    try {
      const artifactData = await client.sendLsClientRequest<JsonObject>('getPipelineRunArtifact', [
        id,
      ]);

      if (deploymentType === 'cloud') {
        const artifactUrl = `${dashboardUrl}/artifact-versions/${id}?tab=overview`;
        dataPanel.setData({ artifactUrl, ...artifactData }, 'Artifact Version Data');
      } else {
        dataPanel.setData({ runUrl, ...artifactData }, 'Artifact Version Data');
      }

      vscode.commands.executeCommand('zenmlPanelView.focus');
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to retrieve artifact version ${id}: ${e}`);
      console.error(e);
    }
  }

  private openArtifactUrl(
    id: string,
    dashboardUrl: string,
    deploymentType: string,
    runUrl: string
  ): void {
    const uri = vscode.Uri.parse(
      deploymentType === 'cloud' ? `${dashboardUrl}/artifact-versions/${id}?tab=overview` : runUrl
    );
    vscode.env.openExternal(uri);
  }

  private openStepUrl(runUrl: string): void {
    const uri = vscode.Uri.parse(runUrl);
    vscode.env.openExternal(uri);
  }

  private async renderDag(panel: vscode.WebviewPanel, node: PipelineTreeItem) {
    const client = LSClient.getInstance();

    let dagData: PipelineRunDag;
    try {
      dagData = await client.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [node.id]);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to receive response from Zenml server: ${e}`);
      return;
    }

    const cssUri = panel.webview.asWebviewUri(this.css);
    const jsUri = panel.webview.asWebviewUri(this.javaScript);
    const graph = this.layoutDag(dagData);
    const svg = await this.drawDag(graph);
    const updateButton = dagData.status === 'running' || dagData.status === 'initializing';
    const title = `${dagData.name} - v${dagData.version}`;

    // And set its HTML content
    panel.webview.html = this.getWebviewContent({ svg, cssUri, jsUri, updateButton, title });
  }

  private async loadSvgWindowLib() {
    const { createSVGWindow } = await import('svgdom');
    this.createSVGWindow = createSVGWindow;
  }

  private loadIcons(path: string): void {
    const ICON_MAP = {
      failed: 'alert.svg',
      completed: 'check.svg',
      cached: 'cached.svg',
      initializing: 'initializing.svg',
      running: 'play.svg',
      database: 'database.svg',
      dataflow: 'dataflow.svg',
    };
    Object.entries(ICON_MAP).forEach(async ([name, fileName]) => {
      try {
        const file = await fs.readFile(path + fileName);
        this.iconSvgs[name] = file.toString();
      } catch (e) {
        this.iconSvgs[name] = '';
        console.error(`Unable to load icon ${name}: ${e}`);
      }
    });
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

  private layoutDag(dagData: PipelineRunDag): Dagre.graphlib.Graph {
    const { nodes, edges } = dagData;
    const graph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: 'TB', ranksep: 35, nodesep: 5 });

    edges.forEach(edge => graph.setEdge(edge.source, edge.target));
    nodes.forEach(node =>
      graph.setNode(node.id, { width: 300, height: node.type === 'step' ? 50 : 44, ...node })
    );

    Dagre.layout(graph);
    return graph;
  }

  private calculateEdges = (
    g: Dagre.graphlib.Graph
  ): Array<{ from: string; points: ArrayXY[] }> => {
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

  private async drawDag(graph: Dagre.graphlib.Graph): Promise<string> {
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

    const nodeGroup = canvas.group().attr('id', 'nodes');

    graph.nodes().forEach(nodeId => {
      const node = graph.node(nodeId) as DagNode & ReturnType<typeof graph.node>;
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

      const container = nodeGroup
        .foreignObject(node.width, node.height)
        .translate(node.x - node.width / 2, node.y - node.height / 2);

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
    <meta http-equiv="Content-Secuirty-Policy" content="default-src 'none';">
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
    cssUri: vscode.Uri;
    jsUri: vscode.Uri;
    updateButton: boolean;
    title: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Secuirty-Policy" content="default-src 'none'; script-src ${jsUri}; style-src ${cssUri};">
    <link rel="stylesheet" href="${cssUri}">
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
