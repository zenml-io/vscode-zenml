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
import { ArrayXY, SVG, registerWindow } from '@svgdotjs/svg.js';
import * as Dagre from 'dagre';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import Panels from '../../common/panels';
import WebviewBase from '../../common/WebviewBase';
import { LSClient } from '../../services/LSClient';
import { DagNode, PipelineRunDag } from '../../types/PipelineTypes';
import { ServerStatus } from '../../types/ServerInfoTypes';
import { PipelineTreeItem, ServerDataProvider } from '../../views/activityBar';
import { PanelDataProvider } from '../../views/panel/panelView/PanelDataProvider';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';

const ROOT_PATH = ['resources', 'dag-view'];
const CSS_FILE = 'dag.css';
const JS_FILE = 'dag-packed.js';
const ICONS_DIRECTORY = '/resources/dag-view/icons/';

export default class DagRenderer extends WebviewBase {
  private static instance: DagRenderer | undefined;
  private createSVGWindow: Function = () => {};
  private iconSvgs: { [name: string]: string } = {};
  private root: vscode.Uri;
  private javaScript: vscode.Uri;
  private css: vscode.Uri;

  constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension Context Not Propagated');
    }

    this.root = vscode.Uri.joinPath(WebviewBase.context.extensionUri, ...ROOT_PATH);
    this.javaScript = vscode.Uri.joinPath(this.root, JS_FILE);
    this.css = vscode.Uri.joinPath(this.root, CSS_FILE);

    this.loadSvgWindowLib();
    this.loadIcons(WebviewBase.context.extensionPath + ICONS_DIRECTORY);
  }

  /**
   * Retrieves a singleton instance of DagRenderer
   *
   * @returns {DagRenderer} The singleton instance
   */
  public static getInstance(): DagRenderer {
    if (!DagRenderer.instance) {
      DagRenderer.instance = new DagRenderer();
    }

    return DagRenderer.instance;
  }

  /**
   * Used to remove DagRenderer WebviewPanels when the extension is deactivated.
   */
  public deactivate(): void {
    DagRenderer.instance = undefined;
  }

  /**
   * Renders DAG Visualization for a piepline run into Webview Panel
   * @param node The Pipeline run to render
   * @returns
   */
  public async createView(node: PipelineTreeItem) {
    const p = Panels.getInstance();
    const existingPanel = p.getPanel(node.id);
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    const panel = p.createPanel(node.id, node.label as string, {
      enableScripts: true,
      localResourceRoots: [this.root],
    });

    panel.webview.onDidReceiveMessage(this.createMessageHandler(panel, node));

    this.renderDag(panel, node);
  }

  private createMessageHandler(
    panel: vscode.WebviewPanel,
    node: PipelineTreeItem
  ): (message: { command: string; id: string }) => Promise<void> {
    const status = ServerDataProvider.getInstance().getCurrentStatus() as ServerStatus;
    const dashboardUrl = status.dashboard_url;
    const deploymentType = status.deployment_type;
    const runUrl =
      dashboardUrl && dashboardUrl !== 'N/A'
        ? `${dashboardUrl}/runs/${node.id}?tab=overview`
        : `Run ID: ${node.id}`;

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

      const cssUri = panel.webview.asWebviewUri(this.css);
      const jsUri = panel.webview.asWebviewUri(this.javaScript);

      // Check if we have a message indicating no step data
      if ('message' in dagData && dagData.message) {
        // Show informative message when step data is not available
        panel.webview.html = this.getNoStepsContent({
          cssUri,
          jsUri,
          message: dagData.message,
          pipelineName: dagData.name || (node.label as string),
          status: dagData.status,
          cspSource: panel.webview.cspSource,
        });
        return;
      }

      // Check if nodes/edges are undefined or empty
      if (!dagData.nodes || !dagData.edges) {
        throw new Error('DAG data is missing nodes or edges');
      }

      const graph = this.layoutDag(dagData);
      const svg = await this.drawDag(graph);
      const updateButton = dagData.status === 'running' || dagData.status === 'initializing';
      const title = `${dagData.name}`;

      // And set its HTML content
      panel.webview.html = this.getWebviewContent({
        svg,
        cssUri,
        jsUri,
        updateButton,
        title,
        cspSource: panel.webview.cspSource,
      });
    } catch (e) {
      console.error(`DAG rendering error: ${e}`);
      const errorMessage = `Failed to render pipeline DAG: ${e instanceof Error ? e.message : String(e)}`;

      // Update the webview with error content instead of leaving it in loading state
      panel.webview.html = this.getErrorContent({
        cssUri: panel.webview.asWebviewUri(this.css),
        jsUri: panel.webview.asWebviewUri(this.javaScript),
        errorMessage,
        pipelineName: node.label as string,
        cspSource: panel.webview.cspSource,
      });
    }
  }

  private getNoStepsContent({
    cssUri,
    jsUri,
    message,
    pipelineName,
    status,
    cspSource,
  }: {
    cssUri: vscode.Uri;
    jsUri: vscode.Uri;
    message: string;
    pipelineName: string;
    status: string;
    cspSource: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource};">
    <link rel="stylesheet" href="${cssUri}">
    <title>DAG - No Steps</title>
</head>
<body>
    <div id="update">
      <p>${pipelineName} (${status})</p><button id="retry-button">Retry</button>
    </div>
    <div class="error-container">
      <div class="error-icon">ℹ️</div>
      <div class="error-title">DAG visualization not available</div>
      <div class="error-message">${message}</div>
      <p>Step data is not included in optimized responses to improve performance. The pipeline run information is still available in the tree view.</p>
    </div>
    <script src="${jsUri}"></script>
    <script>
      document.getElementById('retry-button').addEventListener('click', () => {
        vscode.postMessage({ command: 'update' });
      });
    </script>
</body>
</html>`;
  }

  private getErrorContent({
    cssUri,
    jsUri,
    errorMessage,
    pipelineName,
    cspSource,
  }: {
    cssUri: vscode.Uri;
    jsUri: vscode.Uri;
    errorMessage: string;
    pipelineName: string;
    cspSource: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource};">
    <link rel="stylesheet" href="${cssUri}">
    <title>DAG Error</title>
</head>
<body>
    <div id="update">
      <p>${pipelineName}</p><button id="retry-button">Retry</button>
    </div>
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <div class="error-title">Failed to render pipeline DAG</div>
      <div class="error-message">${errorMessage}</div>
      <p>There was an error while trying to get the DAG data from the ZenML server. Please check the logs for more details.</p>
    </div>
    <script src="${jsUri}"></script>
    <script>
      document.getElementById('retry-button').addEventListener('click', () => {
        vscode.postMessage({ command: 'update' });
      });
    </script>
</body>
</html>`;
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

    Object.entries(ICON_MAP).map(async ([name, fileName]) => {
      try {
        const file = await fs.readFile(path + fileName);
        this.iconSvgs[name] = file.toString();
      } catch (e) {
        this.iconSvgs[name] = '';
        console.error(`Unable to load icon ${name}: ${e}`);
      }
    });
  }

  private layoutDag(dagData: PipelineRunDag): Dagre.graphlib.Graph {
    const { nodes, edges } = dagData;
    const graph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: 'TB', ranksep: 35, nodesep: 5 });

    // Safely handle potentially empty arrays
    if (edges && Array.isArray(edges)) {
      edges.forEach(edge => graph.setEdge(edge.source, edge.target));
    }

    if (nodes && Array.isArray(nodes)) {
      nodes.forEach(node =>
        graph.setNode(node.id, { width: 300, height: node.type === 'step' ? 50 : 44, ...node })
      );
    }

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
        status = node.data.status;
        if (status && typeof status === 'object') {
          status = (status as any)._value_;
        }
        iconSVG = this.iconSvgs[status];

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

      if (iconSVG) {
        const icon = SVG(iconSVG);
        box.add(SVG(icon).attr('class', `icon ${status}`));
      } else {
        console.warn(`Missing icon for status: ${status}`);
      }
      box.element('p').words(node.data.name);
    });
    return canvas.svg();
  }

  private getWebviewContent({
    svg,
    cssUri,
    jsUri,
    updateButton,
    title,
    cspSource,
  }: {
    svg: string;
    cssUri: vscode.Uri;
    jsUri: vscode.Uri;
    updateButton: boolean;
    title: string;
    cspSource: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource};">
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
