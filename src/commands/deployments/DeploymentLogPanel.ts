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
import Panels from '../../common/panels';
import WebviewBase from '../../common/WebviewBase';
import { DeploymentLogsResponse } from '../../types/DeploymentTypes';
import { DeploymentTreeItem } from '../../views/activityBar/deploymentView/DeploymentTreeItems';
import { getDeploymentLogs } from './utils';

/**
 * Message types sent from extension to webview
 */
type DeploymentLogWebviewMessage =
  | { type: 'setLoading' }
  | {
      type: 'setLogs';
      payload: {
        logs: string[];
        deploymentId: string;
        deploymentName: string;
        timestamp: string;
      };
    }
  | { type: 'setError'; payload: { message: string } };

/**
 * Message types received from webview
 */
interface WebviewCommand {
  command: 'refresh';
}

/**
 * Resource paths for the log viewer webview
 */
const RESOURCE_ROOT = ['resources', 'deployment-logs'];

/**
 * DeploymentLogPanel manages webview panels for displaying deployment logs.
 * Each deployment gets its own panel, allowing multiple log views simultaneously.
 */
export default class DeploymentLogPanel extends WebviewBase {
  private static instance: DeploymentLogPanel | undefined;
  private activePanels: Map<string, { panel: vscode.WebviewPanel; deploymentId: string }> =
    new Map();

  private root: vscode.Uri;
  private cssUri: vscode.Uri;
  private jsUri: vscode.Uri;

  constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension context not propagated to DeploymentLogPanel');
    }

    this.root = vscode.Uri.joinPath(WebviewBase.context.extensionUri, ...RESOURCE_ROOT);
    this.cssUri = vscode.Uri.joinPath(this.root, 'logs.css');
    this.jsUri = vscode.Uri.joinPath(this.root, 'logs.js');
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(): DeploymentLogPanel {
    if (!DeploymentLogPanel.instance) {
      DeploymentLogPanel.instance = new DeploymentLogPanel();
    }
    return DeploymentLogPanel.instance;
  }

  /**
   * Clean up when extension is deactivated
   */
  public deactivate(): void {
    this.activePanels.forEach(({ panel }) => panel.dispose());
    this.activePanels.clear();
    DeploymentLogPanel.instance = undefined;
  }

  /**
   * Show the log panel for a deployment
   */
  public async show(node: DeploymentTreeItem): Promise<void> {
    const deploymentId = node.deployment.id;
    const deploymentName = node.deployment.name;
    const panelId = this.getPanelId(deploymentId);

    // Check if panel already exists
    const panels = Panels.getInstance();
    let existingPanel = panels.getPanel(panelId);

    if (existingPanel) {
      existingPanel.reveal();
      // Refresh logs when revealing existing panel
      await this.fetchAndPostLogs(existingPanel, deploymentId, deploymentName);
      return;
    }

    // Create new panel
    const panel = panels.createPanel(panelId, `Logs: ${deploymentName}`, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [this.root],
    });

    // Store reference
    this.activePanels.set(panelId, { panel, deploymentId });

    // Set up message handling
    panel.webview.onDidReceiveMessage(
      async (message: WebviewCommand) => {
        if (message.command === 'refresh') {
          await this.fetchAndPostLogs(panel, deploymentId, deploymentName);
        }
      },
      undefined,
      []
    );

    // Handle panel disposal
    panel.onDidDispose(() => {
      this.activePanels.delete(panelId);
    });

    // Set initial HTML
    panel.webview.html = this.buildHtml(panel, deploymentName);

    // Fetch and display logs
    await this.fetchAndPostLogs(panel, deploymentId, deploymentName);
  }

  /**
   * Generate unique panel ID for a deployment
   */
  private getPanelId(deploymentId: string): string {
    return `deployment-logs-${deploymentId}`;
  }

  /**
   * Fetch logs from the server and post to webview
   */
  private async fetchAndPostLogs(
    panel: vscode.WebviewPanel,
    deploymentId: string,
    deploymentName: string
  ): Promise<void> {
    // Signal loading state
    this.postMessage(panel, { type: 'setLoading' });

    try {
      const result: DeploymentLogsResponse = await getDeploymentLogs(deploymentId);

      // Check for errors in response
      if ('error' in result && result.error) {
        this.postMessage(panel, {
          type: 'setError',
          payload: { message: result.error },
        });
        return;
      }

      // Check for version mismatch
      if ('clientVersion' in result && 'serverVersion' in result) {
        this.postMessage(panel, {
          type: 'setError',
          payload: {
            message: `Client version ${result.clientVersion} is incompatible with server version ${result.serverVersion}`,
          },
        });
        return;
      }

      // Success - send logs to webview
      if ('logs' in result) {
        this.postMessage(panel, {
          type: 'setLogs',
          payload: {
            logs: result.logs,
            deploymentId: result.deploymentId,
            deploymentName: result.deploymentName || deploymentName,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.postMessage(panel, {
        type: 'setError',
        payload: { message: `Failed to fetch logs: ${errorMessage}` },
      });
    }
  }

  /**
   * Post a message to the webview
   */
  private postMessage(panel: vscode.WebviewPanel, message: DeploymentLogWebviewMessage): void {
    panel.webview.postMessage(message);
  }

  /**
   * Build the HTML content for the webview
   */
  private buildHtml(panel: vscode.WebviewPanel, deploymentName: string): string {
    const cssUri = panel.webview.asWebviewUri(this.cssUri);
    const jsUri = panel.webview.asWebviewUri(this.jsUri);
    const cspSource = panel.webview.cspSource;

    // Escape deployment name for HTML
    const escapedName = this.escapeHtml(deploymentName);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource};">
    <link rel="stylesheet" href="${cssUri}">
    <title>Deployment Logs: ${escapedName}</title>
</head>
<body>
    <!-- Header -->
    <header class="log-header">
        <div class="log-header-left">
            <div id="status-indicator" class="status-indicator loading"></div>
            <span id="deployment-title" class="deployment-title">${escapedName}</span>
            <span id="timestamp" class="timestamp"></span>
        </div>
        <div class="log-header-right">
            <div class="log-controls">
                <label class="toggle-control">
                    <input type="checkbox" id="auto-scroll-toggle" checked>
                    <span>Auto-scroll</span>
                </label>
                <button id="refresh-button" class="icon-button" title="Refresh logs" disabled>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 8A6 6 0 1 1 8 2"/>
                        <path d="M14 2v4h-4"/>
                    </svg>
                </button>
            </div>
        </div>
    </header>

    <!-- Main content area -->
    <main id="log-container" class="log-container">
        <!-- Loading state -->
        <div id="loading-state" class="state-container">
            <div class="loading-spinner"></div>
            <div class="state-title">Loading logs...</div>
            <div class="state-message">Fetching deployment logs from the server</div>
        </div>

        <!-- Error state -->
        <div id="error-state" class="state-container error hidden">
            <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="state-title">Failed to load logs</div>
            <div id="error-message" class="state-message"></div>
        </div>

        <!-- Empty state -->
        <div id="empty-state" class="state-container hidden">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <div class="state-title">No logs available</div>
            <div class="state-message">This deployment has no log entries yet</div>
        </div>

        <!-- Log content -->
        <div id="log-content" class="log-content hidden"></div>
    </main>

    <!-- Footer -->
    <footer class="log-footer">
        <span id="log-count" class="log-count"></span>
        <span class="log-footer-hint">Click Refresh to update</span>
    </footer>

    <script src="${jsUri}"></script>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
