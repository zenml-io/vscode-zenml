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
    if (!message.text) {
      console.error('sendMessage command received without text property');
      return;
    }
    try {
      await chatDataProvider.addMessage(
        message.text,
        message.context,
        message.provider,
        message.model
      );
    } catch (error) {
      console.error('Error adding message:', error);
      chatDataProvider.showInfoMessage('Failed to send message. Please try again.');
    }
  },
  clearChat: async (_, chatDataProvider) => {
    try {
      await chatDataProvider.clearChatLog();
    } catch (error) {
      console.error('Error clearing chat log:', error);
      chatDataProvider.showInfoMessage('Failed to clear chat. Please try again.');
    }
  },
  showInfo: (message, chatDataProvider) => {
    if (!message.text) {
      console.error('showInfo command received without text property');
      return Promise.resolve();
    }
    try {
      chatDataProvider.showInfoMessage(message.text);
    } catch (error) {
      console.error('Error showing info message:', error);
    }
    return Promise.resolve();
  },
  updateProvider: (message, chatDataProvider) => {
    if (!message.provider) {
      console.error('updateProvider command received without provider property');
      return Promise.resolve();
    }
    try {
      chatDataProvider.updateProvider(message.provider);
    } catch (error) {
      console.error('Error updating provider:', error);
    }
    return Promise.resolve();
  },
  updateModel: (message, chatDataProvider) => {
    if (!message.model) {
      console.error('updateModel command received without model property');
      return Promise.resolve();
    }
    try {
      chatDataProvider.updateModel(message.model);
    } catch (error) {
      console.error('Error updating model:', error);
    }
    return Promise.resolve();
  },
  prevPage: async (_, chatDataProvider) => {
    try {
      await PipelineDataProvider.getInstance().goToPreviousPage();
      await chatDataProvider.refreshWebview();
    } catch (error) {
      console.error('Error going to previous page:', error);
      chatDataProvider.showInfoMessage('Failed to go to previous page. Please try again.');
    }
  },
  nextPage: async (_, chatDataProvider) => {
    try {
      await PipelineDataProvider.getInstance().goToNextPage();
      await chatDataProvider.refreshWebview();
    } catch (error) {
      console.error('Error going to next page:', error);
      chatDataProvider.showInfoMessage('Failed to go to next page. Please try again.');
    }
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
