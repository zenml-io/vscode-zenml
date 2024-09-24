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
import { renderChatLog, getWebviewContent } from './chatRenderer';
import { handleWebviewMessage } from './chatMessageHandler';
import { EventBus } from '../../services/EventBus';
import { LSP_ZENML_STACK_CHANGED } from '../../utils/constants';
import { getChatResponse, initializeTokenJS } from './utils/TokenUtils';

export class ChatDataProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: ChatMessage[] = [];
  private streamingMessage: ChatMessage | null = null;
  private currentProvider: string = 'Gemini';
  private currentModel: string = 'gemini-pro';
  private eventBus: EventBus = EventBus.getInstance();
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    initializeTokenJS(this.context, this.currentProvider);
    this.eventBus.addListener(LSP_ZENML_STACK_CHANGED, this.refreshWebview.bind(this));
    this._disposables.push(
      new vscode.Disposable(() => this.eventBus.removeListener(LSP_ZENML_STACK_CHANGED, this.refreshWebview.bind(this)))
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    this.configureWebViewOptions(webviewView.webview);
    this.loadWebviewContent();

    const messageListener = async (message: any) => {
      await handleWebviewMessage(message, this);
    };

    webviewView.webview.onDidReceiveMessage(messageListener);
    this._disposables.push(
      new vscode.Disposable(() => webviewView.webview.onDidReceiveMessage(messageListener))
    );
  }

  dispose(): void {
    this._disposables.forEach(disposable => disposable.dispose());
    this._disposables = [];
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
        this.messages,
        this.currentProvider,
        this.getAvailableProviders(),
        this.getAvailableModels()
      );
    }
  }

  private getAvailableProviders(): string[] {
    return ['Gemini', 'OpenAI', 'Anthropic'];
  }

  private getAvailableModels(): string[] {
    switch (this.currentProvider) {
      case 'Gemini':
        return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];
      case 'OpenAI':
        return [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4o-2024-05-13',
          'gpt-4-turbo',
          'gpt-4-turbo-2024-04-09',
          'gpt-4-0125-preview',
          'gpt-4-turbo-preview',
          'gpt-4-1106-preview',
          'gpt-4-vision-preview',
          'gpt-4',
          'gpt-4-0314',
          'gpt-4-0613',
          'gpt-4-32k',
          'gpt-4-32k-0314',
          'gpt-4-32k-0613',
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
          'gpt-3.5-turbo-0301',
          'gpt-3.5-turbo-0613',
          'gpt-3.5-turbo-1106',
          'gpt-3.5-turbo-0125',
          'gpt-3.5-turbo-16k-0613',
        ];
      case 'Anthropic':
        return [
          'claude-3-5-sonnet-20240620',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
          'claude-2.1',
          'claude-2.0',
          'claude-instant-1.2',
        ];
      default:
        return [];
    }
  }

  /**
   * Refreshes the webview once the LSClient emits a notification that the stack changes.
   */
  public async refreshWebview() {
    if (this._view) {
      this.loadWebviewContent();
    }
  }

  async updateProvider(provider: string) {
    this.currentProvider = provider;
    this.currentModel = this.getAvailableModels()[0];

    try {
      await initializeTokenJS(this.context, provider);
      this.loadWebviewContent();
    } catch (error: any) {
      console.error('Error initializing TokenJS:', error);
      vscode.window.showErrorMessage(`Failed to initialize ${provider}: ${error.message}`);
    }
  }

  updateModel(model: string) {
    this.currentModel = model;
  }

  async addMessage(message: string, context?: string[], provider?: string, model?: string) {
    this.messages.push({ role: 'user', content: message });
    this.updateWebviewContent();

    try {
      const responseGenerator = getChatResponse(
        this.messages,
        context || [],
        provider || this.currentProvider,
        model || this.currentModel
      );
      this.streamingMessage = { role: 'assistant', content: '' };

      this.sendMessageToWebview('disableInput');
      let isResponseLoaded = false;

      for await (const partialResponse of responseGenerator) {
        if (!isResponseLoaded) {
          this._view?.webview.postMessage({ command: 'hideLoader' });
          isResponseLoaded = true;
        }

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

  showInfoMessage(text: string) {
    vscode.window.showInformationMessage(text);
  }
}
