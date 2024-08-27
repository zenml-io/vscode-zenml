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
import fs from 'fs/promises';
import { findFirstLineNumber } from '../../common/utilities';
import { ServerDataProvider } from '../../views/activityBar';
import { isServerStatus } from '../server/utils';

/**
 * Gets the Dashboard URL for the corresponding ZenML pipeline run
 *
 * @param {string} id - The id of the ZenML pipeline run to be opened
 * @returns {string} - The URL corresponding to the pipeline run in the ZenML Dashboard
 */
export const getPipelineRunDashboardUrl = (id: string): string => {
  const status = ServerDataProvider.getInstance().getCurrentStatus();

  if (!isServerStatus(status) || status.deployment_type === 'other') {
    return '';
  }

  const currentServerUrl = status.dashboard_url;

  return `${currentServerUrl}/runs/${id}`;
};

const editStepFile = async (filePath: string, newContent: string, oldContent: string) => {
  const TOP_BORDER_DECORATION = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '1px 0 0 0',
    borderColor: '#FF7B00',
    borderStyle: 'solid',
  });
  const BOTTOM_BORDER_DECORATION = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '0 0 1px 0',
    borderColor: '#FF7B00',
    borderStyle: 'solid',
  });
  const HIGHLIGHT_DECORATION = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(255, 141, 33, 0.1)',
  });

  const fileContents = await fs.readFile(filePath, { encoding: 'utf-8' });
  // TODO update to throw error if oldContent is not found in fileContents
  const firstLine = new vscode.Position(findFirstLineNumber(fileContents, oldContent) || 0, 0);
  const lastLine = new vscode.Position(firstLine.line + oldContent.split('\n').length, 0);
  const range = new vscode.Range(firstLine, lastLine);
  const openPath = vscode.Uri.file(filePath);

  vscode.workspace.openTextDocument(openPath).then(doc => {
    vscode.window.showTextDocument(doc);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(openPath, range, newContent + '\n');

    return vscode.workspace.applyEdit(edit).then(success => {
      if (success) {
        const newLastLine = new vscode.Position(firstLine.line + newContent.split('\n').length, 0);

        vscode.window.showTextDocument(doc);
        vscode.window.activeTextEditor?.setDecorations(HIGHLIGHT_DECORATION, [range]);
        vscode.window.activeTextEditor?.setDecorations(TOP_BORDER_DECORATION, [
          new vscode.Range(firstLine, firstLine),
        ]);
        vscode.window.activeTextEditor?.setDecorations(BOTTOM_BORDER_DECORATION, [
          new vscode.Range(newLastLine, newLastLine),
        ]);
      } else {
        vscode.window.showInformationMessage('Error!');
      }
    });
  });
};

const pipelineUtils = {
  getPipelineRunDashboardUrl,
  editStepFile,
};

export default pipelineUtils;
