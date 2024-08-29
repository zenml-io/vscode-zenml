import * as vscode from 'vscode';
import * as fs from 'fs';
import * as marked from 'marked';
import { ChatService } from '../../../services/chatService';
import { chatMessage } from './chatMessage';

export class ChatDataProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: chatMessage[] = []; // Array to store chat messages
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
    return this.messages.filter(msg => msg['role'] != 'system')
      .map((message) => {
        return `<div class="message ${message['role']}">${message['content']}</div>`;
      })
      .join('');
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
