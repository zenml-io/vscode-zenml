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
import * as Dagre from 'dagre';
import * as vscode from 'vscode';
import { getPipelineRunDashboardUrl } from '../../commands/pipelines/utils';
import Panels from '../../common/panels';
import WebviewBase from '../../common/WebviewBase';
import { LSClient } from '../../services/LSClient';
import { PipelineRunDag } from '../../types/PipelineTypes';
import { ServerStatus } from '../../types/ServerInfoTypes';
import { PipelineTreeItem, ServerDataProvider } from '../../views/activityBar';
import { PanelDataProvider } from '../../views/panel/panelView/PanelDataProvider';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';
import { DagConfig, DEFAULT_DAG_CONFIG } from '../DagConfig';
import { IconLoader } from '../utils/IconLoader';
import { StatusUtils } from '../utils/StatusUtils';
import { HtmlTemplateBuilder } from './HtmlTemplateBuilder';
import { SvgRenderer } from './SvgRenderer';

export default class DagRenderer extends WebviewBase {
  private static instance: DagRenderer | undefined;
  private createSVGWindow: () => any = () => ({});
  private iconLoader: IconLoader;
  private svgRenderer?: SvgRenderer;
  private config: DagConfig;
  private root: vscode.Uri;
  private javaScript: vscode.Uri;
  private css: vscode.Uri;

  constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension Context Not Propagated');
    }

    this.config = DEFAULT_DAG_CONFIG;
    this.root = vscode.Uri.joinPath(
      WebviewBase.context.extensionUri,
      ...this.config.paths.rootPath
    );
    this.javaScript = vscode.Uri.joinPath(this.root, this.config.paths.jsFile);
    this.css = vscode.Uri.joinPath(this.root, this.config.paths.cssFile);

    this.iconLoader = new IconLoader(this.config);
    this.loadSvgWindowLib();
    this.initializeRenderer();
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
    // Ensure renderer is initialized before creating view
    if (!this.svgRenderer) {
      await this.initializeRenderer();
    }

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

    await this.renderDag(panel, node);
  }

  private createMessageHandler(
    panel: vscode.WebviewPanel,
    node: PipelineTreeItem
  ): (message: { command: string; id: string }) => Promise<void> {
    const status = ServerDataProvider.getInstance().getCurrentStatus() as ServerStatus;
    const dashboardUrl = status.dashboard_url;
    const deploymentType = status.deployment_type;

    // Use the proper utility function to get dashboard URL
    const pipelineRunDashboardUrl = getPipelineRunDashboardUrl(node.id);
    const runUrl =
      pipelineRunDashboardUrl || 'Dashboard only available when connected to remote ZenML server';

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
    const targetUrl =
      deploymentType === 'cloud' ? `${dashboardUrl}/artifact-versions/${id}?tab=overview` : runUrl;

    // Only open URL if it's a valid URL (not a message about remote server)
    if (targetUrl.startsWith('http')) {
      const uri = vscode.Uri.parse(targetUrl);
      vscode.env.openExternal(uri);
    } else {
      vscode.window.showInformationMessage(
        'Dashboard is only available when connected to a remote ZenML server.'
      );
    }
  }

  private openStepUrl(runUrl: string): void {
    // Only open URL if it's a valid URL (not a message about remote server)
    if (runUrl.startsWith('http')) {
      const uri = vscode.Uri.parse(runUrl);
      vscode.env.openExternal(uri);
    } else {
      vscode.window.showInformationMessage(
        'Dashboard is only available when connected to a remote ZenML server.'
      );
    }
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
        panel.webview.html = HtmlTemplateBuilder.buildNoStepsContent({
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
      const svg = await this.svgRenderer!.drawDag(graph);
      const updateButton = StatusUtils.shouldShowUpdateButton(dagData.status);

      const title = `${dagData.name}`;

      // And set its HTML content
      panel.webview.html = HtmlTemplateBuilder.buildMainContent({
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
      panel.webview.html = HtmlTemplateBuilder.buildErrorContent({
        cssUri: panel.webview.asWebviewUri(this.css),
        jsUri: panel.webview.asWebviewUri(this.javaScript),
        errorMessage,
        pipelineName: node.label as string,
        cspSource: panel.webview.cspSource,
      });
    }
  }

  private async initializeRenderer(): Promise<void> {
    if (this.svgRenderer) {
      return; // Already initialized
    }

    const iconSvgs = await this.iconLoader.loadIcons(WebviewBase.context!.extensionPath);
    this.svgRenderer = new SvgRenderer(this.createSVGWindow, iconSvgs, this.config);
  }

  private async loadSvgWindowLib() {
    const { createSVGWindow } = await import('svgdom');
    this.createSVGWindow = createSVGWindow;
  }

  private layoutDag(dagData: PipelineRunDag): Dagre.graphlib.Graph {
    const { nodes, edges } = dagData;
    const graph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph(this.config.layout);

    // Safely handle potentially empty arrays
    if (edges && Array.isArray(edges)) {
      edges.forEach(edge => graph.setEdge(edge.source, edge.target));
    }

    if (nodes && Array.isArray(nodes)) {
      nodes.forEach(node => {
        const nodeConfig =
          node.type === 'step' ? this.config.nodes.step : this.config.nodes.artifact;
        graph.setNode(node.id, { width: nodeConfig.width, height: nodeConfig.height, ...node });
      });
    }

    Dagre.layout(graph);
    return graph;
  }
}
