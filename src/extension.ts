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
import * as fs from 'fs';
import * as path from 'path';
import * as marked from 'marked';
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

  /**
   * Called when the webview is resolved. Initializes the webview content and sets up the message handling
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    this.configureWebViewOptions(webviewView.webview);
    this.updateWebviewContent();

    // Handle messages received from the webview
    webviewView.webview.onDidReceiveMessage(async message => {
      await this.handleWebviewMessage(message);
    });
  }

  /**
   * Configure the webview to allow scripts to run
   */
  private configureWebViewOptions(webview: vscode.Webview) {
    webview.options = {
      enableScripts: true,
    };
  }
  
  /**
   * Handle incoming messages from the webview.
   */
  private async handleWebviewMessage(message: any) {
    if (message.command === 'sendMessage' && message.text?.trim()) {
      console.log("Handling 'sendMessage' command with text:", message.text);
      await this.addMessage(message.text);
    }
  }

  /**
   * Generate the webview HTML content, including the chat log and the input elements.
   */
  private getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Path to HTML file
    const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'chat.html');
    let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

    // Webview URIs for CSS and JS
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'chat.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'chat.js'));
    const markedUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'marked.min.js'));

    // Chat log HTML
    const chatLogHtml = this.renderChatLog();

    // Replace placeholders in the HTML with actual values
    html = html.replace('${cssUri}', cssUri.toString());
    html = html.replace('${jsUri}', jsUri.toString());
    html = html.replace('${markedUri}', markedUri.toString());
    html = html.replace('${chatLogHtml}', chatLogHtml);
    
    return html;
  }

  /**
   * Render the chat log as HTML.
   */
  private renderChatLog(): string {
    return this.messages.map(msg =>  {
      const isUserMessage = msg.startsWith('User:');
      const className = isUserMessage ? 'user-message' : 'gemini-message';
      const htmlMessage = marked.parse(msg.replace(/^(User:|Gemini:)\s*/, ''));
      return `<div class="message ${className}">${htmlMessage}</div>`;
    }).join('');
  }

  /**
   * Update the webview with the latest content, including the chat message.
   */
  private updateWebviewContent() {
    if (this._view) {
      this._view.webview.html = this.getWebviewContent(
        this._view.webview,
        this.context.extensionUri
      );
    }
  }

  /**
   * Add a message to the chat log, get a response from Gemini, and update the webview.
   */
  async addMessage(message: string) {
    // Add the message to the log
    this.messages.push(`User: ${message}`);

    // Get Gemini's response
    try {
      const botResponse = await this.chatService.getChatResponse(message);
      this.messages.push(`Gemini: ${botResponse}`);
      this.updateWebviewContent();
      this.sendMessageToWebview(`Gemini: ${botResponse}`);
    } catch (error) {
      this.messages.push("Error: Unable to get response from Gemini");
      this.updateWebviewContent();
    }
  }

  /**
   * Send a message from Gemini back to the webview
   */
  private sendMessageToWebview(message: string) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'recieveMessage', text: message});
    }
  }
}
