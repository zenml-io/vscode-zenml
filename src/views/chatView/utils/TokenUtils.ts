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
import { ChatMessage } from '../../../types/ChatTypes';
import { addContext } from './ContextUtils';

let tokenjs: any;

export async function initializeTokenJS(context: vscode.ExtensionContext, provider: string) {
  const apiKeySecret = `zenml.${provider.toLowerCase()}.key`;
  const apiKey = await context.secrets.get(apiKeySecret);

  if (!apiKey) {
    throw new Error(
      `API key for ${provider} not found. Please set the ${apiKeySecret} in VS Code secrets.`
    );
  }
  const config: Record<string, string> = {};
  config['apiKey'] = apiKey;
  const module = await import('token.js');
  const { TokenJS } = module;
  tokenjs = new TokenJS(config);
}

export async function* getChatResponse(
  messages: ChatMessage[],
  context: string[],
  provider: string,
  model: string
): AsyncGenerator<string, void, unknown> {
  const template = `
  You are a ZenML assistant that summarizes users' ZenML information, problem solves users' ZenML problems, or optimizes users' code in their ZenML pipeline runs.

  Every time you get a user message, check the message for Context.

  Structure (with markdown) the output like this:

  <hr>
  <h2>Category 1</h2>
  <hr>
  <strong>Key 1-1</strong>
  value 1-1
  <br>
  <strong>Key 1-2</strong>
  value 1-2
  <br><br>
  <hr>
  <h2>Category 2</h2>
  <hr>
  <strong>Key 2-1</strong>
  value 2-1
  <br>
  <strong>Key 2-2</strong>
  value 2-2
  
  To bold words, use <b></b> tags. Do not ever use asterisks for formatting.
  To write code blocks, use <code></code> tags.
  if there's an explanation at the end, add it like:

  <br><br>
  <hr>
  <h1>Summary</h1>
  <hr>
  <hr>
  Explanation
  <li>point 1</li>
  <li>point 2</li>
  `;
  if (!tokenjs) {
    throw new Error('TokenJS not initialized');
  }

  console.log(`getChatResponse called with provider: ${provider}, model: ${model}`);

  const fullMessages = [
    { role: 'system', content: template },
    { role: 'user', content: await addContext(context) },
    ...messages,
  ];
  try {
    const stream = await tokenjs.chat.completions.create({
      stream: true,
      provider: provider.toLowerCase(),
      model: model,
      messages: fullMessages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      })),
    });

    for await (const part of stream) {
      if (part.choices[0]?.delta?.content) {
        yield part.choices[0].delta.content;
      }
    }
  } catch (error: any) {
    console.error('Error in getChatResponse:', error);
    throw new Error(`Error with ${provider} API: ${error.message}`);
  }
}