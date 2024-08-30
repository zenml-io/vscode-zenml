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
  ): Thenable<void> | void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'registerApiKey':
            this._handleRegisterApiKey(message.provider);
            break;
        }
      },
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'zenml_logo.png')
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} https: 'unsafe-inline'; style-src ${webview.cspSource} https: 'unsafe-inline'; font-src https:;">
          <title>Chat with your ZenML pipelines and data</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    zenml: '#7a3ef8',
                  },
                  fontFamily: {
                    'plus-jakarta': ['"Plus Jakarta Sans"', 'sans-serif'],
                  },
                },
              },
            }
          </script>
          <style>
            body {
              font-family: "Plus Jakarta Sans", sans-serif;
              font-optical-sizing: auto;
              font-weight: 400;
              font-style: normal;
            }
          </style>
        </head>
        <body class="bg-gray-100 text-gray-900 font-plus-jakarta p-6">
          <div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
            <div class="p-8">
              <div class="flex flex-col items-center mb-6">
                <img src="${logoUri}" alt="ZenML Logo" class="h-12 mb-4">
                <h1 class="text-2xl font-bold text-zenml text-center">Chat with your ZenML pipelines and data</h1>
              </div>
              <div class="space-y-4">
                <div>
                  <select id="provider-select" class="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-zenml focus:border-zenml">
                    <option value="" disabled selected>Select Provider</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <button id="register-api-key-button" class="w-full bg-zenml hover:bg-zenml/80 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out">
                    Register API Key
                  </button>
                  <p id="error-message" class="mt-2 text-red-600 text-sm hidden">Please select a provider</p>
                </div>
              </div>
            </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            const selectElement = document.getElementById('provider-select');
            const buttonElement = document.getElementById('register-api-key-button');
            const errorMessageElement = document.getElementById('error-message');

            buttonElement.addEventListener('click', () => {
              const selectedProvider = selectElement.value;
              if (selectedProvider) {
                errorMessageElement.classList.add('hidden');
                vscode.postMessage({
                  command: 'registerApiKey',
                  provider: selectedProvider,
                });
              } else {
                errorMessageElement.classList.remove('hidden');
              }
            });

            selectElement.addEventListener('change', () => {
              errorMessageElement.classList.add('hidden');
            });
          </script>
        </body>
      </html>
    `;
  }

  private _handleRegisterApiKey(provider: string): void {
    switch (provider) {
      case 'OpenAI':
        vscode.commands.executeCommand('zenml.registerOpenAIAPIKey');
        break;
      case 'Claude':
        vscode.commands.executeCommand('zenml.registerClaudeAPIKey');
        break;
      case 'Gemini':
        vscode.commands.executeCommand('zenml.registerGeminiAPIKey');
        break;
      default:
        console.error(`Unsupported provider: ${provider}`);
    }
  }

  dispose(): void {
    this._disposables.forEach((disposable) => disposable.dispose());
  }
}