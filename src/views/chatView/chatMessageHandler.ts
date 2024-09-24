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
import { NetworkError, ValidationError, StorageError } from './utils/CustomErrors';

type CommandHandler = (
  message: WebviewMessage,
  chatDataProvider: ChatDataProvider,
  pipelineDataProvider: PipelineDataProvider
) => Promise<void>;

const commandHandlers: Record<string, CommandHandler> = {
  sendMessage: async (message, chatDataProvider) => {
    if (!message.text) {
      console.error('sendMessage command received without text property');
      chatDataProvider.showInfoMessage('Message text is required.');
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
      if (error instanceof NetworkError) {
        chatDataProvider.showInfoMessage('Network error. Please check your connection and try again.');
      } else if (error instanceof ValidationError) {
        chatDataProvider.showInfoMessage('Invalid message format. Please try again.');
      } else {
        chatDataProvider.showInfoMessage('An unexpected error occurred. Please try again.');
      }
    }
  },
  clearChat: async (_, chatDataProvider) => {
    try {
      await chatDataProvider.clearChatLog();
    } catch (error) {
      console.error('Error clearing chat log:', error);
      if (error instanceof StorageError) {
        chatDataProvider.showInfoMessage('Unable to clear chat history. Storage error occurred.');
      } else {
        chatDataProvider.showInfoMessage('Failed to clear chat. Please try again.');
      }
    }
  },
  showInfo: async (message, chatDataProvider) => {
    if (!message.text) {
      console.error('showInfo command received without text property');
      return;
    }
    try {
      chatDataProvider.showInfoMessage(message.text);
    } catch (error) {
      console.error('Error showing info message:', error);
      chatDataProvider.showInfoMessage('Failed to show info message. Please try again.');
    }
  },
  updateProvider: async (message, chatDataProvider) => {
    if (!message.provider) {
      console.error('updateProvider command received without provider property');
      return;
    }
    try {
      chatDataProvider.updateProvider(message.provider);
    } catch (error) {
      console.error('Error updating provider:', error);
      chatDataProvider.showInfoMessage('Failed to update provider. Please try again.');
    }
  },
  updateModel: async (message, chatDataProvider) => {
    if (!message.model) {
      console.error('updateModel command received without model property');
      return;
    }
    try {
      chatDataProvider.updateModel(message.model);
    } catch (error) {
      console.error('Error updating model:', error);
      chatDataProvider.showInfoMessage('Failed to update model. Please try again.');
    }
  },
  prevPage: async (_, chatDataProvider, pipelineDataProvider) => {
    try {
      await pipelineDataProvider.goToPreviousPage();
      await chatDataProvider.refreshWebview();
    } catch (error) {
      console.error('Error going to previous page:', error);
      chatDataProvider.showInfoMessage('Failed to go to previous page. Please try again.');
    }
  },
  nextPage: async (_, chatDataProvider, pipelineDataProvider) => {
    try {
      await pipelineDataProvider.goToNextPage();
      await chatDataProvider.refreshWebview();
    } catch (error) {
      console.error('Error going to next page:', error);
      chatDataProvider.showInfoMessage('Failed to go to next page. Please try again.');
    }
  },
};

export async function handleWebviewMessage(
  message: WebviewMessage,
  chatDataProvider: ChatDataProvider,
  pipelineDataProvider: PipelineDataProvider
) {
  const handler = commandHandlers[message.command];
  if (handler) {
    await handler(message, chatDataProvider, pipelineDataProvider);
  } else {
    console.warn(`Unknown command: ${message.command}`);
  }
}
