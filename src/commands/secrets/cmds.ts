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

// TODO I don't think retrieval of an api key will live in here

const registerOpenAIAPIKey = async (context: ExtensionContext) => {
  let apiKey = await context.secrets.get('OPENAI_API_KEY');

  if (apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: 'OpenAI API Key already exists, enter a new value to update.',
      password: true,
    });
  } else {
    apiKey = await vscode.window.showInputBox({
      prompt: 'Please enter your OpenAI API key',
      password: true,
    });
  }

  if (apiKey === undefined) {
    return undefined;
  }

  await context.secrets.store('OPENAI_API_KEY', apiKey);
  vscode.window.showInformationMessage('OpenAI API key stored successfully.');
};

export const secretsCommands = {
  registerOpenAIAPIKey,
};
