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
// import { PanelDataProvider } from '../views/panel/panelView/PanelDataProvider';

export class ChatService {
  private static instance: ChatService;
  private initialized: Promise<void>;
  private tokenjs: any;
  private allMessages: string[];

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
    // TODO find another way to access the apiKey, instead of having it hardcoded
    const apiKey = '';
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
      let context = '';
      if (message.includes('environment')) {
        context += this.getEnvironmentData();
      }
      if (message.includes('pipeline')) {
        context += this.getPipelineData();
      }
      if (message.includes('stack')) {
        context += this.getStackComponentData();
        context += this.getStackData();
      }
      if (message.includes('server')) {
        context += this.getServerStatus();
      }
      //   if (message.includes('panel')) {
      //     this.getPanelData();
      //   }

      const completion = await this.tokenjs.chat.completions.create({
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        messages: [
          {
            role: 'user',
            content: message + `Use this context to answer the question: ${context}`,
          },
        ],
      });
      return completion.choices[0]?.message?.content || 'No content';
    } catch (error) {
      console.error('Error with Gemini API:', error);
      return 'Error: Unable to get a response from Gemini.';
    }
  }

  // private getContext() {

  // }

  private addMessage(message: string): void {
    this.allMessages.push(message);
  }

  private getMessages(): string[] {}

  /**
   *
   * @returns A parsed string containing the information of the server.
   */
  private getServerStatus(): string {
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
