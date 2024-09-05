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
import { marked } from 'marked';
import { ChatService } from './chatService';
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
    this.loadWebviewContent();

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
    if (message.command === 'sendMessage' && message.text) {
      await this.addMessage(message.text, message.context);
    }

    if (message.command === 'clearChat') {
      await this.clearChatLog();
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

    // Chat log HTML
    const chatLogHtml = this.renderChatLog();
    let treeItemHtml = this.getTreeHtml();

    // Replace placeholders in the HTML with actual values
    html = html.replace('${cssUri}', cssUri.toString());
    html = html.replace('${jsUri}', jsUri.toString());
    html = html.replace('${treeItemHtml}', treeItemHtml);
    html = html.replace('${chatLogHtml}', chatLogHtml);

    return html;
  };

  private clearChatLog(): void {
    this.messages.length = 0;
    this.updateWebviewContent();
  }

  private getPipelineData(): TreeItem[] {
    let pipelineRuns = PipelineDataProvider.getInstance().pipelineRuns;
    let pipelineTreeItems: TreeItem[] = pipelineRuns.map((run, index) => {
      let formattedStartTime = new Date(run.startTime).toLocaleString();
      let formattedEndTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A';
      let stringValue = `Pipeline run:${JSON.stringify(run)}`;
      return {
        name: run.name,
        value: stringValue,
        title: "Includes all code, logs, and metadata for a specific pipeline run with message",
        hidden: index > 9,
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
    if (pipelineTreeItems.length > 9) { pipelineTreeItems.push({ name: 'Expand' })}
    return pipelineTreeItems;
  }

  private getTreeData() {
    let pipelineData = this.getPipelineData();
    let treeData: TreeItem[] = [
      {name: 'Server', value: 'serverContext', title: 'Includes all server metadata with message'},
      {name: 'Environment', value: 'environmentContext', title: 'Includes all server metadata with message'},
      {
        name: 'Pipeline Runs',
        value: 'pipelineContext',
        title: 'Includes all code, logs, and metadata for pipeline runs with message',
        children : pipelineData
      },
      {name: 'Stack', value: 'stackContext', title: 'Includes all stack metadata with message'},
      {name: 'Stack Components', value: 'stackComponentsContext', title: 'Includes all stack component metadata with message'}
    ];
    return treeData;
  }

  private convertTreeDataToHtml(treeData: TreeItem[], level = 0) {
    let convertedTreeData = treeData.map((item) => {
      let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" fill="none" stroke="none"/></svg>';
      let childrenEl= '', title = '', hidden = '';

      if (item.children) {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
        childrenEl = `<div class="tree-item-children">${this.convertTreeDataToHtml(item.children, level + 1)}</div>`;
      }

      if (item.title) { title = item.title }
      if (item.hidden) { hidden = " hidden" }

      let checkboxEl = level < 2 ? `<input type="checkbox" class="tree-item-checkbox" value='${item.value}'>` : '';

      if (item.name == 'Expand') { 
        hidden += ' expand';
        checkboxEl = ''
      }

      return `<div class="tree-item${hidden}">
        <div class="tree-item-wrapper">
            <div class="tree-item-content" style="padding-left: ${level * 16}px;">
              <span class="tree-item-icon">
                  ${iconSvg}
              </span>
              <span class="tree-item-name" title="${title}">${item.name}</span>
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

  private updateWebviewContent() {
    if (this._view) {
      const chatLogHtml = this.renderChatLog();
      this._view.webview.postMessage({
        command: 'updateChatLog',
        chatLogHtml: chatLogHtml
      });
    }
  }

  /**
   * Update the webview with the latest content, including the chat message.
   */
  private loadWebviewContent() {
    if (this._view) {
      this._view.webview.html = this.getWebviewContent(
        this._view.webview,
        this.context.extensionUri
      );
    }
  }

  /**
   * Add a message to the chat log, get a response from AI provider and update the webview.
   */
  private streamingMessage: ChatMessage | null = null;

  async addMessage(message: string, context?: string[]) {
    this.messages.push({role: 'user', content: message});
    this.updateWebviewContent();

    try {
      const responseGenerator = this.chatService.getChatResponse(this.messages, context || []);
      this.streamingMessage = {role: 'assistant', content: ''};

      // Send message to disable input
      this.sendMessageToWebview('disableInput');

      for await (const partialResponse of responseGenerator) {
        for (const letter of partialResponse) {
          this.streamingMessage.content += letter;
          this.sendMessageToWebview(letter);
          await new Promise(resolve => setTimeout(resolve, 1)); // Adjust delay as needed
        }
      }

      this.messages.push(this.streamingMessage);
      this.streamingMessage = null;
      this.updateWebviewContent();
      this.sendMessageToWebview('enableInput');
    } catch (error) {
      console.error('Error in addMessage:', error);
      this.sendMessageToWebview('Error: Unable to get response from Gemini');
      this.sendMessageToWebview('enableInput');
    }
  }
  
  /**
   * Render the chat log as HTML.
   */
  private renderChatLog(): string {
    const renderer = {
      // @ts-ignore
      code({ text, lang, escaped, isInline }) {
        const code = text.replace(/\n$/, '') + (isInline ? '' : '\n');
      
        if (isInline) {
          return `<code>${code}</code>`;
        }
      
        return '<pre><code>'
          + code
          + '</code></pre>\n';
      }
    };

    // @ts-ignore
    marked.use({ renderer });

    return this.messages.filter(msg => msg['role'] !== 'system')
      .reverse()
      .map((message) => {
        let content = marked.parse(message.content);
        if (message.role === 'user') {
          return `<div class="p-4 user">
              <p class="font-semibold text-zenml">User</p>
              ${content}
          </div>`;
        } else {
          return `<div class="p-4 assistant">
            <p class="font-semibold text-zenml">ZenML Assistant</p>
            ${content}
          </div>`;
        }
      })
      .join('') + this.renderStreamingMessage();
  }

  private renderStreamingMessage(): string {
    if (!this.streamingMessage) {return '';}

    const renderer = {
      // @ts-ignore
      code({ text, lang, escaped, isInline }) {
        const code = text.replace(/\n$/, '') + (isInline ? '' : '\n');
      
        if (isInline) {
          return `<code>${code}</code>`;
        }
      
        return '<pre><code>'
          + code
          + '</code></pre>\n';
      }
    };

    // @ts-ignore
    marked.use({ renderer });

    let content = marked.parse(this.streamingMessage.content);
    return `<div class="p-4 assistant">
      <p class="font-semibold text-zenml">ZenML Assistant</p>
      ${content}
    </div>`;
  }

  /**
   * Send a message from AI provider back to the webview
   */
  private sendMessageToWebview(text: string) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'receiveMessage', text });
    }
  }
}
