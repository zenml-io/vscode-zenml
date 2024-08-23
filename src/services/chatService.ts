import { PipelineDataProvider, PipelineRunTreeItem, PipelineTreeItem, ServerDataProvider } from '../views/activityBar';
import { StackComponentTreeItem } from '../views/activityBar';
import * as vscode from 'vscode';
import { ComponentDataProvider } from '../views/activityBar/componentView/ComponentDataProvider';
import { EnvironmentDataProvider } from '../views/activityBar/environmentView/EnvironmentDataProvider';
import { TokenJS } from 'token.js'

export class ChatService {
    private static instance: ChatService;
    private initialized: Promise<void>;
    private tokenjs: any;

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
      // Use dynamic import to load the ESM module
      // const { TokenJS } = await import('token.js');

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

          const completion = await this.tokenjs.chat.completions.create({
            provider: 'gemini',
            model: 'gemini-1.5-flash',
            messages: [{ role: 'user', content: (message + `Use this context to answer the question: ${context}`) }],
          });
          return completion.choices[0]?.message?.content || 'No content';
    
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
