import { PipelineDataProvider, PipelineRunTreeItem, PipelineTreeItem, ServerDataProvider } from '../views/activityBar';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { MessageContent } from '@langchain/core/messages';
import { StackComponentTreeItem } from '../views/activityBar';
import * as vscode from 'vscode';
import { ComponentDataProvider } from '../views/activityBar/componentView/ComponentDataProvider';
import { EnvironmentDataProvider } from '../views/activityBar/environmentView/EnvironmentDataProvider';

export class ChatService {
    private static instance: ChatService;
    private messageHistories: Record<string, InMemoryChatMessageHistory> = {};
    private sessionId: string = "abc42";
    private initialized: Promise<void>;
    private model!: ChatGoogleGenerativeAI;

    private constructor() {
      this.initialized = this.initialize();
  }

    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    private async initialize() {
      this.model = new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        apiKey: ""
      });
    }

    public async getChatResponse(message: string): Promise<MessageContent> {
        try {
          let context = ''
          if (message.includes('environment')) {
            context += this.getEnvironmentData()
          }
          if (message.includes('pipeline')) {
            context += this.getPipelineData()
          }
          if (message.includes('stack')) {
            context += this.getStackComponentData()
          }
          if (message.includes('server')) {
            context += this.getServerStatus()
          }

          const prompt = ChatPromptTemplate.fromMessages([
            [
              "system",
              `You are a helpful assistant who remembers all details the user shares with you.`,
            ],
            ["placeholder", "{chat_history}"],
            ["human", "{input}"],
          ]);

          const chain = prompt.pipe(this.model);

          const withMessageHistory = new RunnableWithMessageHistory({
            runnable: chain,
            getMessageHistory: async (sessionId) => {
              if (this.messageHistories[sessionId] === undefined) {
                this.messageHistories[sessionId] = new InMemoryChatMessageHistory();
              }
              return this.messageHistories[sessionId];
            },
            inputMessagesKey: "input",
            historyMessagesKey: "chat_history",
          });

          const config = {
            configurable: {
              sessionId: this.sessionId,
            },
          };
          
          const response = await withMessageHistory.invoke(
            {
              input: (message + `Here is contexual information for reference: ${context}`),
            },
            config
          );

          return response.content;
        } catch (error) {
            console.error('Error with Gemini API:', error);
            return 'Error: Unable to get a response from Gemini.';
        }
    }

  // private getContext() {

  // }

  private getServerStatus(): string {
    return (`Server Status Data:\n` + JSON.stringify(ServerDataProvider.getInstance().getCurrentStatus()) + '\n');
  }

  private getStackComponentData(): string {
    let components = ComponentDataProvider.getInstance().items;
    let componentData = components.map((item: vscode.TreeItem) => {
      if (item instanceof StackComponentTreeItem) {
        let { name, type, flavor, id } = item.component;
        let stackId = item.stackId;
        let idInfo = stackId ? ` - Stack ID: ${stackId}` : '';
        let componentId = ` - Component ID: ${id}`;
        return `Name: ${name}, Type: ${type}, Flavor: ${flavor}${componentId}${idInfo}`;
      } else {
        return `Label: ${item.label}, Description: ${item.description || 'N/A'}`;
      }
    }).join('\n');
    return `Stack Component Data:\n${componentData}\n`;
  }

  private getEnvironmentData(): string {
    let data = EnvironmentDataProvider.getInstance().getEnvironmentData()
    let contextString = data.map((item) => `${item.label}: ${item.description || ''}`).join('\n');
    return `Environment Data:\n${contextString}\n`;
  }

  private getPipelineData(): string {
    let pipelineData = PipelineDataProvider.getInstance().getPipelineData()
    let contextString = pipelineData.map((pipelineRun: PipelineTreeItem) => {
      return (`Pipeline Run:\n` + pipelineRun.children?.map((item: PipelineRunTreeItem) => {
        return `${item.tooltip}`
      }).join('\n') + `\n${pipelineRun.description}`)
    }).join('\n')
    return `Pipeline Data:\n${contextString}\n`;
  }

  // private getStackData(): string {

  // }

  // private getPanelData(): {

  // }
}
