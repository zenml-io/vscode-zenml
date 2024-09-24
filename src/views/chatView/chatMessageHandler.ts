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
import { PipelineDataProvider } from '../activityBar';
import { ChatDataProvider } from './ChatDataProvider';
import { WebviewMessage } from '../../types/ChatTypes';

type CommandHandler = (message: WebviewMessage, chatDataProvider: ChatDataProvider) => Promise<void>;

const commandHandlers: Record<string, CommandHandler> = {
  sendMessage: async (message, chatDataProvider) => {
    if (message.text) {
      await chatDataProvider.addMessage(
        message.text,
        message.context,
        message.provider,
        message.model
      );
    }
  },
  clearChat: async (_, chatDataProvider) => {
    await chatDataProvider.clearChatLog();
  },
  showInfo: (message, chatDataProvider) => {
    if (message.text) {
      chatDataProvider.showInfoMessage(message.text);
    }
    return Promise.resolve();
  },
  updateProvider: (message, chatDataProvider) => {
    if (message.provider) {
      chatDataProvider.updateProvider(message.provider);
    }
    return Promise.resolve();
  },
  updateModel: (message, chatDataProvider) => {
    if (message.model) {
      chatDataProvider.updateModel(message.model);
    }
    return Promise.resolve();
  },
  prevPage: async (_, chatDataProvider) => {
    await PipelineDataProvider.getInstance().goToPreviousPage();
    await chatDataProvider.refreshWebview();
  },
  nextPage: async (_, chatDataProvider) => {
    await PipelineDataProvider.getInstance().goToNextPage();
    await chatDataProvider.refreshWebview();
  },
};

export async function handleWebviewMessage(message: WebviewMessage, chatDataProvider: ChatDataProvider) {
  const handler = commandHandlers[message.command];
  if (handler) {
    await handler(message, chatDataProvider);
  } else {
    console.warn(`Unknown command: ${message.command}`);
  }
}
