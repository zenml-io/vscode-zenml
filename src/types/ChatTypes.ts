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

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  /** The role of the message sender (e.g., user, assistant). */
  role: string;
  /** The content of the message. */
  content: string;
}

/**
 * Represents an item in a tree structure.
 */
export interface TreeItem {
  /** The name of the tree item. */
  name: string;
  /** The value associated with the tree item (optional). */
  value?: string | number;
  /** The children of the tree item (optional). */
  children?: TreeItem[];
  /** The title of the tree item (optional). */
  title?: string;
  /** Whether the tree item is hidden (optional). */
  hidden?: boolean;
  /** Whether the tree item is the first page (optional). */
  firstPage?: boolean;
  /** Whether the tree item is the last page (optional). */
  lastPage?: boolean;
}

/**
    * Represents a context item in the tree structure.
    */
export interface ContextItem {
  /** The name of the context item. */
  name: string;
  /** The value associated with the context item. */
  value: string;
  /** The title of the context item. */
  title: string;
  /** The children of the context item (optional). */
  children?: TreeItem[];
}

/**
 * Represents the available AI models.
 */
export type AIModel =
  | 'gemini-1.5-pro'
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

/**
 * Represents a message sent to the webview.
 */
export interface WebviewMessage {
  /** The command to be executed in the webview. */
  command: 'sendMessage' | 'clearChat' | 'showInfo' | 'updateProvider' | 'updateModel' | 'prevPage' | 'nextPage';
  /** The text content of the message (if applicable). */
  text?: string;
  /** Additional context for the message (if applicable). */
  context?: string[];
  /** The AI provider to be used (if applicable). */
  provider?: 'openai' | 'anthropic' | 'gemini';
  /** The AI model to be used (if applicable). */
  model?: AIModel;
}