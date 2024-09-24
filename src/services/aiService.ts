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

const supportedLLMProviders = ['anthropic', 'gemini', 'openai'] as const;
export type SupportedLLMProviders = (typeof supportedLLMProviders)[number];

const supportedAnthropicModels = [
  'claude-3-5-sonnet-20240620',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
] as const;
const supportedGeminiModels = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'] as const;
const supportedOpenAIModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] as const;

type AnthropicModels = (typeof supportedAnthropicModels)[number];
type GeminiModels = (typeof supportedGeminiModels)[number];
type OpenAIModels = (typeof supportedOpenAIModels)[number];

export type SupportedLLMModels = AnthropicModels | GeminiModels | OpenAIModels;

export interface FixMyPipelineResponse {
  message: string;
  code: { language: string; content: string }[];
}

export class AIService {
  private static instance: AIService;
  private context: ExtensionContext;
  public provider: SupportedLLMProviders | null;
  public model: SupportedLLMModels | null;
  private supportedModels: Record<SupportedLLMProviders, readonly string[]> = {
    anthropic: supportedAnthropicModels,
    gemini: supportedGeminiModels,
    openai: supportedOpenAIModels,
  };

  private constructor(context: ExtensionContext) {
    this.context = context;

    const configuration = vscode.workspace.getConfiguration('zenml').get('llm-model') as
      | string
      | null;

    if (configuration === null) {
      this.provider = null;
      this.model = null;
      return;
    }

    const [provider, model] = configuration.split('.') as [
      SupportedLLMProviders,
      SupportedLLMModels,
    ];
    this.provider = provider;
    this.model = model;
  }

  private async setAPIKey() {
    if (!this.provider) {
      return;
    }

    const keyStr = `${this.provider.toUpperCase()}_API_KEY`;
    const apiKey = await this.context.secrets.get(`zenml.${this.provider}.key`);
    process.env[keyStr] = process.env[keyStr] || apiKey;

    if (!process.env[keyStr] && !apiKey) {
      vscode.window.showErrorMessage(
        `No ${this.provider} key configured. Please add an environment variable of save a variable through the command palette.`
      );
    }
  }

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
    if (!this.provider || !this.model) {
      // TODO display an error
      return;
    }

    await this.setAPIKey();
    const tokenjs = new TokenJS();
    const completion = await tokenjs.chat.completions.create({
      provider: this.provider,
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an advanced AI programming assistant tasked with troubleshooting pipeline runs for ZenML into an explanation that is both easy to understand and meaningful. Construct an explanation that:
    - Places the emphasis on the 'why' of the error, explaining possible causes of the problem, beyond just detailing what the error is.
    - Do not make any assumptions or invent details that are not supported by the code or the user-provided context
    - For the code snippets, please provide the entire content of the source code with any required edits made
    - Please respond only in markdown syntax`,
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

  public getSupportedModels(provider: SupportedLLMProviders): string[] {
    return this.supportedModels[provider].slice();
  }

  public getSupportedProviders(): string[] {
    return supportedLLMProviders.slice();
  }

  public setModel(provider: SupportedLLMProviders, model: SupportedLLMModels) {
    this.provider = provider;
    this.model = model;
    const config = `${provider}.${model}`;
    vscode.workspace.getConfiguration('zenml').update('llm-model', config);
  }
}
