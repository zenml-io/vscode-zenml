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
import { ChatMessage, TreeItem } from '../../types/ChatTypes';
import { getTreeData } from './utils/PipelineUtils';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  messages: ChatMessage[],
  currentProvider: string,
  availableProviders: string[],
  availableModels: string[]
): string {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'chat.html');
  let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'chat.css')
  );
  const jsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'chat-view', 'chat.js')
  );

  const chatLogHtml = renderChatLog(messages);
  let treeItemHtml = getTreeHtml();
  let providerDropdownHtml = getProviderDropdownHtml(currentProvider, availableProviders);
  let modelDropdownHtml = getModelDropdownHtml(availableModels);

  html = html.replace('${cssUri}', cssUri.toString());
  html = html.replace('${jsUri}', jsUri.toString());
  html = html.replace('${treeItemHtml}', treeItemHtml);
  html = html.replace('${providerDropdownHtml}', providerDropdownHtml);
  html = html.replace('${modelDropdownHtml}', modelDropdownHtml);
  html = html.replace('${chatLogHtml}', chatLogHtml);

  return html;
}

function getProviderDropdownHtml(currentProvider: string, availableProviders: string[]): string {
  const options = availableProviders
    .map(
      provider =>
        `<option value="${provider}" ${provider === currentProvider ? 'selected' : ''}>${provider}</option>`
    )
    .join('');

  return `
    <select id="provider-dropdown" class="model-dropdown">
      ${options}
    </select>
  `;
}

function getModelDropdownHtml(availableModels: string[]): string {
  const options = availableModels
    .map(model => `<option value="${model}">${model}</option>`)
    .join('');

  return `
    <select id="model-dropdown" class="model-dropdown">
      ${options}
    </select>
  `;
}

export function renderChatLog(
  messages: ChatMessage[],
  streamingMessage: ChatMessage | null = null
): string {
  const renderer = {
    // @ts-ignore
    code({ text, lang, escaped, isInline }) {
      const code = text.replace(/\n$/, '') + (isInline ? '' : '\n');
      return isInline ? `<code>${code}</code>` : '<pre><code>' + code + '</code></pre>\n';
    },
  };

  // @ts-ignore
  marked.use({ renderer });

  const renderedMessages = messages
    .filter(msg => msg['role'] !== 'system')
    .map(message => {
      let content = marked.parse(message.content);
      const roleClass = message.role === 'user' ? 'user' : 'assistant';
      const roleName = message.role === 'user' ? 'User' : 'ZenML Assistant';
      return `<div class="p-4 ${roleClass}">
        <p class="font-semibold text-zenml">${roleName}</p>
        ${content}
      </div>`;
    })
    .join('');

  const streamingContent = streamingMessage
    ? `<div class="p-4 assistant">
        <p class="font-semibold text-zenml">ZenML Assistant</p>
        ${marked.parse(streamingMessage.content)}
      </div>`
    : '';

  return renderedMessages + streamingContent;
}

function getTreeHtml(): string {
  let treeData = getTreeData();
  return convertTreeDataToHtml(treeData);
}

function convertTreeDataToHtml(treeData: TreeItem[], level = 0): string {
  let convertedTreeData = treeData.map(item => {
    let iconSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" fill="none" stroke="none"/></svg>';
    let prevPageEl = '';
    let nextPageEl = '';
    let childrenEl = '';
    let title = '';

    if (item.children) {
      iconSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
      childrenEl = `<div class="tree-item-children">${convertTreeDataToHtml(item.children, level + 1)}</div>`;
    }

    if (item.title) {
      title = item.title;
    }

    let checkboxEl = level < 2 ? `<input type="checkbox" class="tree-item-checkbox" value='${item.value}'>` : '';

    if (item.title === 'pagination') {
      checkboxEl = '';
      if (item.firstPage) {
        nextPageEl = `<button class"tree-item-button" id="nextPage">Next</button>`;
      } else if (item.lastPage) {
        prevPageEl = `<button class"tree-item-button" id="prevPage">Prev</button>`;
      } else {
        nextPageEl = `<button class"tree-item-button" id="nextPage">Next</button>`;
        prevPageEl = `<button class"tree-item-button" id="prevPage">Prev</button>`;
      }
    }

    return `<div class="tree-item">
      <div class="tree-item-wrapper">
        <div class="tree-item-content" style="padding-left: ${level * 16}px;">
          <span class="tree-item-icon">${iconSvg}</span>
          ${prevPageEl}
          <span class="tree-item-name" title="${title}">${item.name}</span>
          ${nextPageEl}
          ${checkboxEl}
        </div>
        ${childrenEl}
      </div>
    </div>`;
  });
  return convertedTreeData.join('\n');
}
