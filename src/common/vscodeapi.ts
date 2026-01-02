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

import {
  commands,
  ConfigurationScope,
  Disposable,
  DocumentSelector,
  languages,
  LanguageStatusItem,
  LogOutputChannel,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration,
  WorkspaceFolder,
} from 'vscode';

export function createOutputChannel(name: string): LogOutputChannel {
  return window.createOutputChannel(name, { log: true });
}

export function getConfiguration(
  config: string,
  scope?: ConfigurationScope
): WorkspaceConfiguration {
  return workspace.getConfiguration(config, scope);
}

export function registerCommand(
  command: string,
  callback: (...args: any[]) => any,
  thisArg?: any
): Disposable {
  return commands.registerCommand(command, callback, thisArg);
}

export const { onDidChangeConfiguration } = workspace;

export function isVirtualWorkspace(): boolean {
  const isVirtual =
    workspace.workspaceFolders && workspace.workspaceFolders.every(f => f.uri.scheme !== 'file');
  return !!isVirtual;
}

export function getWorkspaceFolders(): readonly WorkspaceFolder[] {
  return workspace.workspaceFolders ?? [];
}

export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined {
  return workspace.getWorkspaceFolder(uri);
}

export function createLanguageStatusItem(
  id: string,
  selector: DocumentSelector
): LanguageStatusItem {
  return languages.createLanguageStatusItem(id, selector);
}
