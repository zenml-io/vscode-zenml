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
import path from 'path';

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
  const fileContents = await fs.readFile(filePath, { encoding: 'utf-8' });
  // TODO update to throw error if oldContent is not found in fileContents
  const firstLine = new vscode.Position(findFirstLineNumber(fileContents, oldContent) || 0, 0);
  const lastLine = new vscode.Position(firstLine.line + oldContent.split('\n').length, 0);
  const oldRange = new vscode.Range(firstLine, lastLine);
  const fileUri = vscode.Uri.file(filePath);

  vscode.window.showTextDocument(fileUri);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(fileUri, oldRange, newContent);

  return vscode.workspace.applyEdit(edit).then(async success => {
    if (success) {
      vscode.commands.executeCommand('workbench.files.action.compareWithSaved', fileUri);
    } else {
      // TODO proper error handling
      vscode.window.showInformationMessage('Error!');
    }
  });
};

const pipelineUtils = {
  getPipelineRunDashboardUrl,
  editStepFile,
};

export default pipelineUtils;
