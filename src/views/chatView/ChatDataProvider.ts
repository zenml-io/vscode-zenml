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
import * as marked from 'marked';
import { ChatService } from '../../services/chatService';
import { ChatMessage, TreeItem } from '../../types/ChatTypes';
import { PipelineDataProvider } from '../activityBar';

export class ChatDataProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: ChatMessage[] = []; // Array to store chat messages
  private chatService: ChatService;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.chatService = ChatService.getInstance(this.context);
  }

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
      await this.addMessage(message.text, message.context);
    }
  }

  /**
   * Generate the webview HTML content, including the chat log and the input elements.
   */
  private getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Path to HTML file
    const htmlPath = vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'chat.html');
    let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

    // Webview URIs for CSS and JS
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'chat.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'chat.js')
    );
    const markedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'marked.min.js')
    );

    // Chat log HTML
    const chatLogHtml = this.renderChatLog();
    let treeItemHtml = this.getTreeHtml();

    // Replace placeholders in the HTML with actual values
    html = html.replace('${cssUri}', cssUri.toString());
    html = html.replace('${jsUri}', jsUri.toString());
    html = html.replace('${markedUri}', markedUri.toString());
    html = html.replace('${treeItemHtml}', treeItemHtml);
    html = html.replace('${chatLogHtml}', chatLogHtml);

    return html;
  }

  /**
   * Render the chat log as HTML.
   */
  private renderChatLog(): string {
    return this.messages.filter(msg => msg['role'] !== 'system')
      .map((message) => {
        let content = marked.parse(message.content);
        if (message.role === 'user') {
          return `<div class="bg-gray-100 p-4 rounded-lg">
              <p class="font-semibold text-zenml">User</p>
              ${content}
          </div>`;
        } else {
          return `<div class="p-4 rounded-lg">
            <p class="font-semibold text-zenml">ZenML Assistant</p>
            ${content}
          </div>`;
        }
      })
      .join('');
  }

  private getPipelineData(): TreeItem[] {
    let pipelineRuns = PipelineDataProvider.getInstance().pipelineRuns;
    let pipelineTreeItems = pipelineRuns.map((run) => {
      let formattedStartTime = new Date(run.startTime).toLocaleString();
      let formattedEndTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A';
      let stringValue = `Pipeline run:${JSON.stringify(run)}`;
      return {
        name: run.name,
        value: stringValue,
        children: [
          { name: run.status },
          { name: run.stackName },
          { name: formattedStartTime },
          { name: formattedEndTime },
          { name: `${run.os} ${run.osVersion}` },
          { name: run.pythonVersion },
        ]
      };
    });
    return pipelineTreeItems;
  }

  private getTreeData() {
    let pipelineData = this.getPipelineData();
    let treeData: TreeItem[] = [
      {name: 'Server', value: 'serverContext'},
      {name: 'Environment', value: 'environmentContext'},
      {
        name: 'Pipeline Runs',
        value: 'pipelineContext',
        children : pipelineData
      },
      {name: 'Stack', value: 'stackContext'},
      {name: 'Stack Components', value: 'stackComponentsContext'}
    ];
    return treeData;
  }

  private convertTreeDataToHtml(treeData: TreeItem[], level = 0) {
    let convertedTreeData = treeData.map((item) => {
      let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" fill="none" stroke="none"/></svg>';
      let childrenEl = '';

      if (item.children) {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
        childrenEl = `<div class="tree-item-children">${this.convertTreeDataToHtml(item.children, level + 1)}</div>`;
      }

      let checkboxEl = level < 2 ? `<input type="checkbox" class="tree-item-checkbox" value='${item.value}'>` : '';

      return `<div class="tree-item">
        <div class="tree-item-wrapper">
            <div class="tree-item-content" style="padding-left: ${level * 16}px;">
              <span class="tree-item-icon">
                  ${iconSvg}
              </span>
              <span class="tree-item-name">${item.name}</span>
              ${checkboxEl}
            </div>
            ${childrenEl}
        </div>
      </div>`;
    });
    return convertedTreeData.join('\n');
  }

  private getTreeHtml(): string {
    let treeData = this.getTreeData();
    return this.convertTreeDataToHtml(treeData);
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
  async addMessage(message: string, context?: string[]) {
    this.messages.push({role: 'user', content: `${message}`});

    try {
      const botResponse = await this.chatService.getChatResponse(this.messages, context);
      this.messages.push({role: 'assistant', content: `${botResponse}`});
      this.updateWebviewContent();
      this.sendMessageToWebview(`${botResponse}`);
    } catch (error) {
      this.messages.push({role: 'system', content: 'Error: Unable to get response from Gemini'});
      this.updateWebviewContent();
    }
  }

  /**
   * Send a message from Gemini back to the webview
   */
  private sendMessageToWebview(message: string) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'recieveMessage', text: message });
    }
  }
}
