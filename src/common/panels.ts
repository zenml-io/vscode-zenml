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
import * as vscode from 'vscode';

/**
 * Handles creation and monitoring of webview panels.
 */
export default class Panels {
  private static instance: Panels | undefined;
  private openPanels: { [id: string]: vscode.WebviewPanel };

  constructor() {
    this.openPanels = {};
  }

  /**
   * Retrieves a singleton instance of Panels
   * @returns {Panels} The singleton instance
   */
  public static getInstance(): Panels {
    if (Panels.instance === undefined) {
      Panels.instance = new Panels();
    }
    return Panels.instance;
  }

  /**
   * Creates a webview panel
   * @param {string} id ID of the webview panel to create
   * @param {string} label Title of webview panel tab
   * @param {vscode.WebviewPanelOptions & vscode.WebviewOptions} options
   * Options applied to the webview panel
   * @returns {vscode.WebviewPanel} The webview panel created
   */
  public createPanel(
    id: string,
    label: string,
    options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
  ) {
    const panel = vscode.window.createWebviewPanel(id, label, vscode.ViewColumn.One, options);
    panel.webview.html = this.getLoadingContent();

    this.openPanels[id] = panel;

    panel.onDidDispose(() => {
      this.deregisterPanel(id);
    }, null);

    return panel;
  }

  /**
   * Gets existing webview panel
   * @param {string} id ID of webview panel to retrieve.
   * @param {boolean} forceSpinner Whether to change the html content or not
   * @returns {vscode.WebviewPanel | undefined} The webview panel if it exists,
   * else undefined
   */
  public getPanel(id: string, forceSpinner: boolean = false): vscode.WebviewPanel | undefined {
    const panel = this.openPanels[id];

    if (panel && forceSpinner) {
      panel.webview.html = this.getLoadingContent();
    }

    return panel;
  }

  private deregisterPanel(id: string) {
    delete this.openPanels[id];
  }

  private getLoadingContent(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
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
}
