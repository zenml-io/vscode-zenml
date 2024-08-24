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
import { EventBus } from './services/EventBus';
import { LSClient } from './services/LSClient';
import { ZenExtension } from './services/ZenExtension';
import { refreshUIComponents } from './utils/refresh';
import { EnvironmentDataProvider } from './views/activityBar/environmentView/EnvironmentDataProvider';
import { registerEnvironmentCommands } from './commands/environment/registry';
import { LSP_ZENML_CLIENT_INITIALIZED } from './utils/constants';
import { toggleCommands } from './utils/global';
import DagRenderer from './commands/pipelines/DagRender';
import WebviewBase from './common/WebviewBase';
import { ChatService } from './services/chatService';
import { marked } from 'marked';

export async function activate(context: vscode.ExtensionContext) {
  const eventBus = EventBus.getInstance();
  const lsClient = LSClient.getInstance();

  const handleZenMLClientInitialized = async (isInitialized: boolean) => {
    console.log('ZenML client initialized: ', isInitialized);
    if (isInitialized) {
      await toggleCommands(true);
      await refreshUIComponents();
    }
  };

  eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, handleZenMLClientInitialized);

  vscode.window.createTreeView('zenmlEnvironmentView', {
    treeDataProvider: EnvironmentDataProvider.getInstance(),
  });
  registerEnvironmentCommands(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('zenmlChatView', new ChatViewProvider(context))
  );

  await ZenExtension.activate(context, lsClient);

  context.subscriptions.push(
    new vscode.Disposable(() => {
      eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, handleZenMLClientInitialized);
    })
  );

  WebviewBase.setContext(context);
}

/**
 * Deactivates the ZenML extension.
 *
 * @returns {Promise<void>} A promise that resolves to void.
 */
export async function deactivate(): Promise<void> {
  const lsClient = LSClient.getInstance().getLanguageClient();

  if (lsClient) {
    await lsClient.stop();
    EventBus.getInstance().emit('lsClientReady', false);
  }
  DagRenderer.getInstance()?.deactivate();
}

// TODO: ChatViewProvider should be moved into it's own folder/file in the src/views/activityBar folder
//
class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: string[] = []; // Array to store chat messages
  private chatService: ChatService = ChatService.getInstance(); // ChatService instance

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getWebviewContent(
      webviewView.webview,
      this.context.extensionUri
    );
    webviewView.webview.onDidReceiveMessage(async message => {
      if (message.command === 'sendMessage') {
        await this.addMessage(message.text);
      }
    });
  }

  // Generate the Webview content
  getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'chat.css'));
    const chatLogHtml = this.messages.join('');

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZenML Chat</title>
        <link href="${cssUri}" rel="stylesheet" />
      </head>
      <body>
        <div id="chatLog">${chatLogHtml}</div>
        <div id="inputContainer">
            <input type="text" id="messageInput" placeholder="Type your message here" />
            <button id="sendMessage">Send</button>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            
            document.getElementById('sendMessage').addEventListener('click', () => {
                const messageInput = document.getElementById('messageInput');
                const message = messageInput.value;
                if (message.trim()) {
                    vscode.postMessage({ command: 'sendMessage', text: message });
                    messageInput.value = ''; // Clear input after sending
                }
            });
        </script>
      </body>
      </html>`;
  }

  // Add a new message to the chat log and send to Gemini
  async addMessage(message: string) {
    this.messages.push(`User: ${marked.parse(message)}`); // Add the message to the log

    // Get the bot's response and add it to the log
    const botResponse = await this.chatService.getChatResponse(message);
    this.messages.push(`Gemini: ${marked.parse(botResponse)}`);

    // Re-render the Webview content
    this._view &&
      (this._view.webview.html = this.getWebviewContent(
        this._view.webview,
        this.context.extensionUri
      )); // Re-render the Webview

    // Post the bot's response back to the webview
    this._view &&
      this._view.webview.postMessage({ command: 'receiveMessage', text: `Gemini: ${botResponse}` });
  }
}
