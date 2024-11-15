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
import { PipelineDataProvider } from '../activityBar';

export class ChatDataProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: ChatMessage[] = [];
  private streamingMessage: ChatMessage | null = null;
  private currentProvider: string = 'OpenAI';
  private currentModel: string = this.getAvailableModels()[0];
  private eventBus: EventBus = EventBus.getInstance();
  private _disposables: vscode.Disposable[] = [];
  private refreshWebviewBound = this.refreshWebview.bind(this);

  constructor(private readonly context: vscode.ExtensionContext) {
    initializeTokenJS(this.context, this.currentProvider);
    this.eventBus.addListener(LSP_ZENML_STACK_CHANGED, this.refreshWebviewBound);
    this._disposables.push(
      new vscode.Disposable(() =>
        this.eventBus.removeListener(LSP_ZENML_STACK_CHANGED, this.refreshWebviewBound)
      )
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    this.configureWebViewOptions(webviewView.webview);
    this.refreshWebview();

    const messageListener = async (message: any) => {
      const pipelineDataProvider = PipelineDataProvider.getInstance();
      await handleWebviewMessage(message, this, pipelineDataProvider);
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
        this.currentModel,
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
        return ['gemini-1.5-pro', 'gemini-1.5-flash', 'error'];
      case 'OpenAI':
        return ['gpt-4o-mini', 'gpt-3.5-turbo'];
      case 'Anthropic':
        return ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'];
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
    // Doesn't update if there's no change to avoid infinite loops with the frontend
    if (this.currentProvider === provider) {
      return;
    }

    this.currentProvider = provider;
    this.currentModel = this.getAvailableModels()[0];
    this._view?.webview.postMessage({ command: 'updateModel', text: this.currentModel });

    try {
      await initializeTokenJS(this.context, provider);
      this.refreshWebview();
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
    this.streamingMessage = null;
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
        }
      }

      this.messages.push(this.streamingMessage);
      this.streamingMessage = null;
      this.updateWebviewContent();
      this.sendMessageToWebview('enableInput');
    } catch (error: any) {
      console.error('Error in addMessage:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occured.';
      // Save the error message so it'll still be rendered in subsequent messages
      this.messages.push({ role: 'assistant', content: errorMessage });
      this.sendMessageToWebview(`${errorMessage}`);
      this.sendMessageToWebview('enableInput');
      this._view?.webview.postMessage({ command: 'hideLoader' });
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
