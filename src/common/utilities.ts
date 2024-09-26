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
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { DocumentSelector, LogLevel, Uri, WorkspaceFolder } from 'vscode';
import { Trace } from 'vscode-jsonrpc/node';
import { getWorkspaceFolders, isVirtualWorkspace } from './vscodeapi';
import { simpleGit, SimpleGit, grepQueryBuilder } from 'simple-git';

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

export function findFirstLineNumber(str: string, substr: string): number | null {
  const strLines = str.split('\n');
  const substrLines = substr.split('\n');

  let substrCounter = 0;
  let firstLine = null;
  for (let strCounter = 0; strCounter < strLines.length; strCounter++) {
    if (strLines[strCounter] === substrLines[substrCounter]) {
      if (substrCounter === 0) {
        firstLine = strCounter;
      }

      substrCounter++;

      if (substrCounter >= substrLines.length) {
        break;
      }
    } else {
      substrCounter = 0;
      firstLine = null;
    }
  }

  return firstLine;
}

export async function searchWorkspaceByFileContent(content: string) {
  const files = await vscode.workspace.findFiles('**/*');
  const pythonFiles = files.filter(file => file.toString().endsWith('.py'));
  let matches: vscode.Uri[] = [];
  let fileContents: string[] = [];

  await Promise.all(
    pythonFiles.map(async file => {
      try {
        console.log(file.fsPath);

        return await vscode.workspace.openTextDocument(file).then(doc => {
          const docText = doc.getText();

          const normalizedDocText = docText.replace(/\r\n/g, '\n');
          const normalizedContent = content.replace(/\r\n/g, '\n');
          if (normalizedDocText.includes(normalizedContent)) {
            matches.push(file);
            fileContents.push(docText);
          }
        });
      } catch (e) {
        const error = e as Error;
        console.error(
          `Something went wrong while trying to access ${file.fsPath}: ${error.message}`
        );
      }
    })
  );

  const results = matches.map((uri, i) => ({ uri, content: fileContents[i] }));
  return results;
}

export async function searchGitCacheByFileContent(content: string) {
  const GREP_OPTIONS = ['-I', '-w', '-F', '--full-name', '--cached'];
  const workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];
  let matches: vscode.Uri[] = [];
  let fileContents: string[] = [];
  let git: SimpleGit;

  let matchingFilePaths: string[] | undefined;
  for (let root of workspaceRoots) {
    let matchingLines: string[] | undefined;

    try {
      git = simpleGit({ baseDir: root });
      const lines = content.split(/\r?\n/).filter(line => line !== '');
      for (let line of lines) {
        if (!matchingFilePaths) {
          matchingFilePaths = [...(await git.grep(line, GREP_OPTIONS)).paths].map(filePath =>
            path.join(root, filePath)
          );
          continue;
        }
        if (matchingFilePaths.length === 0) break;

        matchingLines = [...(await git.grep(line, GREP_OPTIONS)).paths].map(filePath =>
          path.join(root, filePath)
        );

        matchingFilePaths = matchingFilePaths.filter(filePath => matchingLines?.includes(filePath));
      }

      const rootRegex = new RegExp(root, 'g');
      matchingLines = matchingLines?.map(path => path.replace(rootRegex, '').slice(1));
      for (let path of matchingLines || []) {
        fileContents.push(await git.show(`HEAD:${path}`));
      }
    } catch {
      console.info(`No git repository found at ${root}`);
    }
  }

  matches = matchingFilePaths?.map(path => vscode.Uri.file(path)) || [];
  const results = matches.map((uri, i) => ({ uri, content: fileContents[i] }));
  return results;
}
