import * as vscode from 'vscode';
import { TokenJS } from 'token.js';
import {
  PipelineDataProvider,
  PipelineRunTreeItem,
  PipelineTreeItem,
  ServerDataProvider,
  StackDataProvider,
  StackComponentTreeItem,
} from '../views/activityBar';
import { ComponentDataProvider } from '../views/activityBar/componentView/ComponentDataProvider';
import { EnvironmentDataProvider } from '../views/activityBar/environmentView/EnvironmentDataProvider';
import { request } from 'axios';
// import { PanelDataProvider } from '../views/panel/panelView/PanelDataProvider';

export class ChatService {
  private static instance: ChatService;
  private initialized: Promise<void>;
  private tokenjs: any;
  private allMessages: object[];

  private constructor() {
    this.initialized = this.initialize();
    this.allMessages = [];
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  private async initialize() {
    // TODO find another way to access the apiKey, instead of having it hardcoded
    const apiKey = '***';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.tokenjs = new TokenJS({ apiKey });
  }

  public async getChatResponse(message: string): Promise<String> {
    //Recreate or copy from langchain
    //minimize everything when you enter a question
    //markdown editor
    //tooltips for what the context does
    //sample questions
    //prompt engineering (system prompt)
    //syntax like @stacks for context
    //tests
    //Stack Data Provider and Panel Data Provider need to be implemented
    try {
      this.addUserMessage(message);
      if (message.includes('environment')) {
        this.addContext('environment');
      }

      const completion = await this.tokenjs.chat.completions.create({
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        messages: this.allMessages,
      });

      return completion.choices[0]?.message?.content || 'No content';
    } catch (error) {
      console.error('Error with Gemini API:', error);
      return 'Error: Unable to get a response from Gemini.';
    }
  }


  private addContext(requestedContext: string): void {
    let systemMessage = { role: 'system', content: "Use this context to answer the question. " };
    if (requestedContext === 'server') {
        systemMessage.content += this.getServerData();
    }
    if (requestedContext === 'environment') {
        systemMessage.content += this.getEnvironmentData();
    }
    if (requestedContext === 'pipeline') {
        systemMessage.content += this.getPipelineData();
    }
    if (requestedContext === 'stack_components') {
        systemMessage.content += this.getStackComponentData();
    }
    if (requestedContext === 'stack') {
        systemMessage.content += this.getStackData();
    }
    this.allMessages.push(systemMessage);
  }

//   private addSystemMessage(message: string): void {
//     let systemMessage = { role: 'system', content: message };
//     this.allMessages.push(systemMessage);
//   }

  private addUserMessage(message: string): void {
    let userMessage = { role: 'user', content: message };
    this.allMessages.push(userMessage);
  }

//   private getRecentMessages(): string[] {
//   }

  /**
   *
   * @returns A parsed string containing the information of the server.
   */
  private getServerData(): string {
    let serverData = ServerDataProvider.getInstance().getCurrentStatus();
    let contextString =
      `URL: ${serverData.url}\n` +
      `Dashboard URL: ${serverData.dashboard_url}\n` +
      `Version: ${serverData.version}\n` +
      `Store Type: ${serverData.store_type}\n` +
      `Deployment Type: ${serverData.deployment_type}\n` +
      `Database Type: ${serverData.database_type}\n` +
      `Secrets Store Type: ${serverData.secrets_store_type}\n` +
      `ID: ${serverData.id}\n` +
      `Debug: ${serverData.debug}\n` +
      `Auth Scheme ${serverData.auth_scheme}`;
    return `Server Status Data:\n${contextString}\n`;
  }

  private getStackComponentData(): string {
    let components = ComponentDataProvider.getInstance().items;
    let componentData = components
      .map((item: vscode.TreeItem) => {
        if (item instanceof StackComponentTreeItem) {
          let { name, type, flavor, id } = item.component;
          let stackId = item.stackId;
          let idInfo = stackId ? ` - Stack ID: ${stackId}` : '';
          let componentId = ` - Component ID: ${id}`;
          return `Name: ${name}, Type: ${type}, Flavor: ${flavor}${componentId}${idInfo}`;
        } else {
          return `Label: ${item.label}, Description: ${item.description || 'N/A'}`;
        }
      })
      .join('\n');
    return `Stack Component Data:\n${componentData}\n`;
  }

  private getEnvironmentData(): string {
    let environmentData = EnvironmentDataProvider.getInstance().getEnvironmentData();
    let contextString = environmentData
      .map(item => `${item.label}: ${item.description || ''}`)
      .join('\n');
    return `Environment Data:\n${contextString}\n`;
  }

  private getPipelineData(): string {
    let pipelineData = PipelineDataProvider.getInstance().getPipelineData();
    let contextString = pipelineData
      .map((pipelineRun: PipelineTreeItem) => {
        return (
          `Pipeline Run:\n` +
          pipelineRun.children
            ?.map((item: PipelineRunTreeItem) => {
              return `${item.tooltip}`;
            })
            .join('\n') +
          `\n${pipelineRun.description}`
        );
      })
      .join('\n');
    return `Pipeline Data:\n${contextString}\n`;
  }

  private getStackData(): string {
    let stackData = StackDataProvider.getInstance().items;
    let contextString = stackData
      .map(item => `Name: ${item.label}\n` + `ID: ${item.id}\n` + `Active: ${item.isActive}`)
      .join('\n');
    return `Stack Data:\n${contextString}\n`;
  }

  //   private getPanelData(): string {
  //     let panelData = PanelDataProvider.getInstance();
  //     console.log(panelData);
  //     return ``;
  //   }
}
