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
  role: 'user' | 'assistant' | 'system';
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
 * Represents the available AI models grouped by provider.
 */
const OPENAI_MODELS = {
  GPT4: {
    DEFAULT: 'gpt-4o-mini',
  },
  GPT35: {
    DEFAULT: 'gpt-3.5-turbo',
  },
} as const;

const ANTHROPIC_MODELS = {
  CLAUDE_SONNET: {
    DEFAULT: 'claude-3-5-sonnet-20240620',
  },
  CLAUDE_OPUS: {
    DEFAULT: 'claude-3-opus-20240229',
  },
} as const;

const GEMINI_MODELS = {
  GEMINI: {
    DEFAULT: 'gemini-1.5-pro',
    FLASH: 'gemini-1.5-flash',
  },
} as const;

/**
 * AIModel is a union type of the nested values from the constants.
 */
export type AIModel =
  | (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS][keyof (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS]]
  | (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS][keyof (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS]]
  | (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS][keyof (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS]];

/**
 * Represents a message sent to the webview.
 */
export interface WebviewMessage {
  /** The command to be executed in the webview. */
  command:
    | 'sendMessage'
    | 'clearChat'
    | 'showInfo'
    | 'updateProvider'
    | 'updateModel'
    | 'prevPage'
    | 'nextPage';
  /** The text content of the message (if applicable). */
  text?: string;
  /** Additional context for the message (if applicable). */
  context?: string[];
  /** The AI provider to be used (if applicable). */
  provider?: 'openai' | 'anthropic' | 'gemini';
  /** The AI model to be used (if applicable). */
  model?: AIModel;
}
