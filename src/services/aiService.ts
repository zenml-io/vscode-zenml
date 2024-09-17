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
// typescript incorrectly identifies the .js as a file extension, not the name of the module
// @ts-expect-error
import { TokenJS } from 'token.js';

export interface FixMyPipelineResponse {
  message: string;
  code: { language: string; content: string }[];
}

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

  // TODO make private after its working
  private extractPythonSnippets(response: string): string[] {
    return response
      .split('```')
      .filter(ele => ele.startsWith('python'))
      .map(snippet => snippet.slice(7));
  }

  public static getInstance(context: ExtensionContext) {
    if (!AIService.instance) {
      AIService.instance = new AIService(context);
    }
    return AIService.instance;
  }

  public async fixMyPipelineRequest(
    log: string,
    code: string
  ): Promise<FixMyPipelineResponse | undefined> {
    const apiKey = await this.getApiKey();

    if (process.env['OPENAI_API_KEY'] === undefined && apiKey) {
      process.env['OPENAI_API_KEY'] = apiKey;
    }

    if (!apiKey) {
      vscode.window.showErrorMessage('No OpenAI API Key available. Please register your key.');
      throw new Error('No OpenAI API Key available.');
    }

    const tokenjs = new TokenJS();

    const completion = await tokenjs.chat.completions.create({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an advanced AI programming assistant tasked with troubleshooting pipeline runs for ZenML into an explanation that is both easy to understand and meaningful. Construct an explanation that:
    - Places the emphasis on the 'why' of the error, explaining possible causes of the problem, beyond just detailing what the error is.
    -Do not make any assumptions or invent details that are not supported by the code or the user-provided context
    -For the code snippets, please provide the entire content of the source code with any required edits made`,
        },
        {
          role: 'user',
          content: `Here is the content of the error message: ${log}`,
        },
        { role: 'user', content: `Here is the source code where the error occured: ${code}` },
        {
          role: 'user',
          content:
            'Now, please explain some possible causes of the error. If you identify any code errors that could resolve the issue, please also provide the full content of the source code with the proposed changes made.',
        },
      ],
    });

    const response = completion.choices[0].message.content;

    if (response === null) {
      return undefined;
    }

    const pythonSnippets = this.extractPythonSnippets(response).map(snippet => {
      return { language: 'python', content: snippet };
    });

    return {
      message: response,
      code: pythonSnippets,
    };
  }

  // TODO implement fetching list of LLMs
  public async getModels(provider: string) {
    let models: string[] = [];
    switch (provider) {
      case 'Anthropic':
        // fetch list of ChatGPT models
        models = ['these', 'are'];
        break;
      case 'Google':
        models = ['simply'];
        // fetch list of Gemini models
        break;
      case 'OpenAI':
        models = ['some', 'test', 'values'];
        // fetch list of Claude models
        break;
    }

    return models;
  }

  // TODO fetch a secret for the default LLM
  public getDefaultModel() {}

  // TODO set a secret for the default LLM
  public setDefaultModel(model: string) {}
}
