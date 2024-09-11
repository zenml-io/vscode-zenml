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
import { ChatDataProvider } from '../../views/chatView/ChatDataProvider';

const openChat = (context: vscode.ExtensionContext) => {
  const panel = vscode.window.createWebviewPanel('zenmlChat', 'ZenML Chat', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });

  const chatDataProvider = new ChatDataProvider(context);

  const fakeContext = {} as vscode.WebviewViewResolveContext;

  const dummyCancellationToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: callback => {
      return new vscode.Disposable(() => {});
    },
  };

  const fakeWebviewView = {
    webview: panel.webview,
    onDidDispose: panel.onDidDispose,
  } as vscode.WebviewView;

  chatDataProvider.resolveWebviewView(fakeWebviewView, fakeContext, dummyCancellationToken);

  panel.onDidDispose(() => {
    // Clean up resources or perform any necessary actions when the panel is disposed
  });
};

export const chatCommands = {
  openChat,
};
