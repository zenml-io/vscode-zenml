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
  Example Response Format:
  <h2>Section Title</h2>
  <strong>Key</strong>: Value<br>
  Use <code> for inline code and <strong> for bolding.
  `;
  if (!tokenjs) {
    throw new Error('TokenJS not initialized');
  }

  console.log(`getChatResponse called with provider: ${provider}, model: ${model}`);

  const fullMessages = [
    { role: 'system', content: template },
    { role: 'system', content: await addContext(context) },
    ...messages,
  ];

  const stream = await tokenjs.chat.completions.create({
    stream: true,
    provider: provider.toLowerCase(),
    model: model,
    messages: fullMessages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    })),
  });

  let buffer = '';
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    for await (const part of stream) {
      if (part.choices[0]?.delta?.content) {
        buffer += part.choices[0].delta.content;
      }

      // Stream from the buffer continuously
      while (buffer.length > 0) {
        yield buffer[0];
        buffer = buffer.slice(1);
        await delay(5);
      }
    }

    // Continue emptying the buffer after the stream ends
    while (buffer.length > 0) {
      yield buffer[0];
      buffer = buffer.slice(1);
      await delay(5);
    }
  } catch (streamError) {
    console.error('Streaming error in getChatResponse:', streamError);
    throw new Error(
      `Streaming error with ${provider} API: ${streamError instanceof Error ? streamError.message : String(streamError)}`
    );
  }
}
