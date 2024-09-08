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
import { ChatMessage } from '../../types/ChatTypes';
import { getChatResponse, initializeTokenJS } from './utils';
import { renderChatLog, getWebviewContent } from './chatRenderer';
import { handleWebviewMessage } from './chatMessageHandler';

export class ChatDataProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: ChatMessage[] = [];
  private streamingMessage: ChatMessage | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    initializeTokenJS(context);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    this.configureWebViewOptions(webviewView.webview);
    this.loadWebviewContent();

    webviewView.webview.onDidReceiveMessage(async message => {
      await handleWebviewMessage(message, this);
    });
  }

  private configureWebViewOptions(webview: vscode.Webview) {
    webview.options = {
      enableScripts: true,
    };
  }

  private loadWebviewContent() {
    if (this._view) {
      this._view.webview.html = getWebviewContent(
        this._view.webview,
        this.context.extensionUri,
        this.messages
      );
    }
  }

  async addMessage(message: string, context?: string[]) {
    this.messages.push({ role: 'user', content: message });
    this.updateWebviewContent();

    try {
      const responseGenerator = getChatResponse(this.messages, context || []);
      this.streamingMessage = { role: 'assistant', content: '' };

      this.sendMessageToWebview('disableInput');

      for await (const partialResponse of responseGenerator) {
        for (const letter of partialResponse) {
          this.streamingMessage.content += letter;
          this.sendMessageToWebview(letter);
          await new Promise(resolve => setTimeout(resolve, 1));
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

  clearChatLog(): void {
    this.messages.length = 0;
    this.updateWebviewContent();
  }

  updateWebviewContent() {
    if (this._view) {
      const chatLogHtml = renderChatLog(this.messages, this.streamingMessage);
      this._view.webview.postMessage({
        command: 'updateChatLog',
        chatLogHtml: chatLogHtml,
      });
    }
  }

  sendMessageToWebview(text: string) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'receiveMessage', text });
    }
  }
}