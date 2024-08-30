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

import type { ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export interface FixMyPipelineResponse {
  message: string;
  code: string[];
}

const CodeSnippet = z.object({
  language: z.string(),
  code: z.string(),
});

const FixMyPipeline = z.object({
  error_message_explanation: z.string(),
  corrected_code_options: z.array(CodeSnippet),
});

export class AIService {
  private static instance: AIService;
  private context: ExtensionContext;

  private constructor(context: ExtensionContext) {
    this.context = context;
  }

  private async getApiKey() {
    const apiKey = await this.context.secrets.get('zenml.openai.key');
    return apiKey;
  }

  public static getInstance(context: ExtensionContext) {
    if (!AIService.instance) {
      AIService.instance = new AIService(context);
    }
    return AIService.instance;
  }

  public async fixMyPipelineRequest(log: string, code: string): Promise<FixMyPipelineResponse> {
    const apiKey = await this.getApiKey();

    if (!apiKey) {
      vscode.window.showErrorMessage('No OpenAI API Key available. Please register your key.');
      throw new Error('No OpenAI API Key available.');
    }
    const openai = new OpenAI({ apiKey });

    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an advanced AI programming assistant tasked with troubleshooting pipeline runs for ZenML into an explanation that is both easy to understand and meaningful. Construct an explanation that:
    - Places the emphasis on the 'why' of the error, explaining possible causes of the problem, beyond just detailing what the error is
    - Provides at least one way to modify the provided code that could resolve the error
    
    Do not make any assumptions or invent details that are not supported by the code or the user-provided context.`,
        },
        {
          role: 'user',
          content: `Here is the content of the error message: ${log}`,
        },
        { role: 'user', content: `Here is the code where the error occured: ${code}` },
        {
          role: 'user',
          content:
            'Now, please expalin some possible causes of the error as well as at least one option for fixing the error. If there are any typos, present those first in the possible solutions.',
        },
      ],
      response_format: zodResponseFormat(FixMyPipeline, 'fix_my_pipeline'),
    });

    console.log('\n\n\n', completion, '\n\n\n');

    return {
      message: '', // TODO
      code: [],
    };
  }
}
