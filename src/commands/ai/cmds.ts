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
import AIStepFixer from '../pipelines/AIStepFixer';

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

const displayNextCodeRecommendation = () => {
  let filePath = vscode.window.activeTextEditor?.document.fileName;
  if (!filePath) return;

  AIStepFixer.updateCodeRecommendation(filePath);
};

export const aiCommands = {
  sendOpenAIRequest,
  displayNextCodeRecommendation,
};
