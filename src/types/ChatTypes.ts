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

export interface ChatMessage {
  role: string;
  content: string;
}

export interface TreeItem {
  name: string;
  value?: string | number;
  children?: TreeItem[];
  title?: string;
  hidden?: boolean;
  firstPage?: boolean;
  lastPage?: boolean;
}

export interface WebviewMessage {
  command: 'sendMessage' | 'clearChat' | 'showInfo' | 'updateProvider' | 'updateModel' | 'prevPage' | 'nextPage';
  text?: string;
  context?: string[];
  provider?: 'openai' | 'anthropic' | 'gemini';
  model?: | 'gemini-1.5-pro' 
  | 'gemini-1.5-flash' 
  | 'gemini-1.0-pro'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4o-2024-05-13'
  | 'gpt-4-turbo'
  | 'gpt-4-turbo-2024-04-09'
  | 'gpt-4-0125-preview'
  | 'gpt-4-turbo-preview'
  | 'gpt-4-1106-preview'
  | 'gpt-4-vision-preview'
  | 'gpt-4'
  | 'gpt-4-0314'
  | 'gpt-4-0613'
  | 'gpt-4-32k'
  | 'gpt-4-32k-0314'
  | 'gpt-4-32k-0613'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-16k'
  | 'gpt-3.5-turbo-0301'
  | 'gpt-3.5-turbo-0613'
  | 'gpt-3.5-turbo-1106'
  | 'gpt-3.5-turbo-0125'
  | 'gpt-3.5-turbo-16k-0613'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-2.1'
  | 'claude-2.0'
  | 'claude-instant-1.2';
}