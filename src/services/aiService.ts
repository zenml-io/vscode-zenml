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
import OpenAI from 'openai';
import { getSecret } from '../common/vscodeapi';

export const fixMyPipelineRequest = async (
  context: ExtensionContext,
  log: string,
  code: string
) => {
  const apiKey = await getSecret(context, 'OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey: apiKey });

  const completion = await openai.chat.completions.create({
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
          'Now, please expalin some possible causes of the error as well as at least one option for fixing the error',
      },
    ],
  });

  return completion;
};

export const 
