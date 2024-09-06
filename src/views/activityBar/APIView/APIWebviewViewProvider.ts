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

export class APIWebviewViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Add this line to log console messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'registerLLMAPIKey':
          this._handleRegisterApiKey();
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'nonce-${nonce}';">
        <title>ZenML API View</title>
        <style nonce="${nonce}">
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
          }
          .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
          }
          h1 {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-foreground);
            text-align: center;
            margin: 0;
          }
          .content {
            padding: 20px;
          }
          select, button {
            width: 100%;
            padding: 8px 12px;
            margin-bottom: 16px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-weight: bold;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          #error-message {
            color: var(--vscode-errorForeground);
            font-size: 14px;
            margin-top: 8px;
            display: none;
          }
        </style>
      </head>
      <body>
        <button id="register-api-key-button">Register LLM API Key</button>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const button = document.getElementById('register-api-key-button');
          button.addEventListener('click', () => {
            vscode.postMessage({ command: 'registerLLMAPIKey' });
          });
        </script>
      </body>
    </html>
  `;
  }

  private _handleRegisterApiKey(): void {
    vscode.window.showInformationMessage('Registering LLM API Key');
    vscode.commands.executeCommand('zenml.registerLLMAPIKey');
  }

  dispose(): void {
    this._disposables.forEach(disposable => disposable.dispose());
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
