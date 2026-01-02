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
// or implied. See the License for the specific language governing
// permissions and limitations under the License.
import * as fs from 'fs-extra';
import * as path from 'path';
import { DocumentSelector, LogLevel, Uri, WorkspaceFolder } from 'vscode';
import { Trace } from 'vscode-jsonrpc/node';
import { getWorkspaceFolders, isVirtualWorkspace } from './vscodeapi';

function logLevelToTrace(logLevel: LogLevel): Trace {
  switch (logLevel) {
    case LogLevel.Error:
    case LogLevel.Warning:
    case LogLevel.Info:
      return Trace.Messages;

    case LogLevel.Debug:
    case LogLevel.Trace:
      return Trace.Verbose;

    case LogLevel.Off:
    default:
      return Trace.Off;
  }
}

export function getLSClientTraceLevel(channelLogLevel: LogLevel, globalLogLevel: LogLevel): Trace {
  if (channelLogLevel === LogLevel.Off) {
    return logLevelToTrace(globalLogLevel);
  }
  if (globalLogLevel === LogLevel.Off) {
    return logLevelToTrace(channelLogLevel);
  }
  const level = logLevelToTrace(
    channelLogLevel <= globalLogLevel ? channelLogLevel : globalLogLevel
  );
  return level;
}

export async function getProjectRoot(): Promise<WorkspaceFolder> {
  const workspaces: readonly WorkspaceFolder[] = getWorkspaceFolders();
  if (workspaces.length === 0) {
    return {
      uri: Uri.file(process.cwd()),
      name: path.basename(process.cwd()),
      index: 0,
    };
  } else if (workspaces.length === 1) {
    return workspaces[0];
  } else {
    let rootWorkspace = workspaces[0];
    let root = undefined;
    for (const w of workspaces) {
      if (await fs.pathExists(w.uri.fsPath)) {
        root = w.uri.fsPath;
        rootWorkspace = w;
        break;
      }
    }

    for (const w of workspaces) {
      if (root && root.length > w.uri.fsPath.length && (await fs.pathExists(w.uri.fsPath))) {
        root = w.uri.fsPath;
        rootWorkspace = w;
      }
    }
    return rootWorkspace;
  }
}

export function getDocumentSelector(): DocumentSelector {
  return isVirtualWorkspace()
    ? [{ language: 'python' }]
    : [
        { scheme: 'file', language: 'python' },
        { scheme: 'untitled', language: 'python' },
        { scheme: 'vscode-notebook', language: 'python' },
        { scheme: 'vscode-notebook-cell', language: 'python' },
      ];
}
