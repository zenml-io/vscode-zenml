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
import type { ExtensionContext } from 'vscode';
import OpenAI from 'openai';
import { getSecret } from '../../common/vscodeapi';

const sendOpenAIRequest = async (context: ExtensionContext) => {
  const apiKey = await getSecret(context, 'OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey: apiKey });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful programming assistant.',
      },
      {
        role: 'user',
        content: 'Hi! How is your day?',
      },
    ],
  });

  return completion;
};

const editStepFile = (filePath: string, newContent: string, originalContent: string) => {
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

  const firstLine = new vscode.Position(2, 0); // TODO update to dynamically find the correct line
  const lastLine = new vscode.Position(firstLine.line + newContent.split('\n').length - 1, 0);
  const range = new vscode.Range(firstLine, lastLine);
  const openPath = vscode.Uri.file(filePath);

  vscode.workspace.openTextDocument(openPath).then(doc => {
    vscode.window.showTextDocument(doc);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(openPath, range, newContent + '\n');

    return vscode.workspace.applyEdit(edit).then(success => {
      if (success) {
        vscode.window.showTextDocument(doc);
        vscode.window.activeTextEditor?.setDecorations(HIGHLIGHT_DECORATION, [range]);
        vscode.window.activeTextEditor?.setDecorations(TOP_BORDER_DECORATION, [
          new vscode.Range(firstLine, firstLine),
        ]);
        vscode.window.activeTextEditor?.setDecorations(BOTTOM_BORDER_DECORATION, [
          new vscode.Range(lastLine, lastLine),
        ]);
      } else {
        vscode.window.showInformationMessage('Error!');
      }
    });
  });
};

export const aiCommands = {
  sendOpenAIRequest,
  editStepFile,
};
