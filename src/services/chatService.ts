import * as vscode from 'vscode';
import axios from 'axios';
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
import { LSClient } from './LSClient';
import { DagArtifact, DagStep, PipelineRunDag } from '../types/PipelineTypes';
import { JsonObject } from '../views/panel/panelView/PanelTreeItem';
import { ZenmlGlobalConfigResp } from '../types/LSClientResponseTypes';
import { TreeItem } from 'vscode';
import { chatMessage } from '../views/activityBar/chatView/chatMessage';

export class ChatService {
  private static instance: ChatService;
  private tokenjs: any;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initialize();
  }

  public static getInstance(context: vscode.ExtensionContext): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService(context);
    }
    return ChatService.instance;
  }

  private async initialize() {
    try {
      const module = await import('token.js');
      const { TokenJS } = module;

      // Use context to access secrets
      const apiKey = await this.context.secrets.get('API_KEY');
      if (!apiKey) {
        vscode.window.showErrorMessage('No Gemini API key found. Please register one');

      }
      this.tokenjs = new TokenJS({ apiKey });
    } catch (error) {
      console.error('Error loading TokenJS:', error);
    }
  }

  public async getChatResponse(messages: chatMessage[],  context?: string[] | undefined): Promise<string> {
    try {
      if (context) {
        messages = this.addContext(messages, context);
      }
      
      const completion = await this.tokenjs.chat.completions.create({
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        messages: messages,
      });

      return completion.choices[0]?.message?.content || 'No content';
    } catch (error) {
      console.error('Error with Gemini API:', error);
      return 'Error: Unable to get a response from Gemini.';
    }
  }

  private addContext(messages: chatMessage[], requestedContext: string[]): chatMessage[] {
    let systemMessage: chatMessage = { role: 'system', content: 'Context:' };
    if (requestedContext.includes('serverContext')) {
      systemMessage.content += this.getServerData();
    }
    if (requestedContext.includes('environmentContext')) {
      systemMessage.content += this.getEnvironmentData();
    }
    if (requestedContext.includes('pipelineContext')) {
      systemMessage.content += this.getPipelineData();
    }
    if (requestedContext.includes('stackContext')) {
      systemMessage.content += this.getStackData();
    }
    if (requestedContext.includes('stackComponentsContext')) {
      systemMessage.content += this.getStackComponentData();
    }
    if (requestedContext.includes('recentPipelineContext')) {
      systemMessage.content += this.getRecentPipelineRunData();
    }
    messages.push(systemMessage);
    return messages
  }

  /**
   *
   * @returns A parsed string containing the information of the server.
   */
  private getServerData(): string {
    let serverData = ServerDataProvider.getInstance().getCurrentStatus();
    return `Server Status Data:\n${JSON.stringify(serverData)}\n`;
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
    //Check if this.items works instead
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

  private getRecentPipelineRunData() {
    let pipelineData = PipelineDataProvider.getInstance().getPipelineData()[0];
    let contextString = JSON.stringify(pipelineData);
    return `Pipeline Data:\n${contextString}\n`;
  }

  private getStackData(): string {
    let stackData = StackDataProvider.getInstance().items;
    let contextString = stackData
      .map(item => {
        let stackItem = item as TreeItem & { isActive: boolean; id: string };
        return `Name: ${item.label}\n` + `ID: ${stackItem.id}\n` + `Active: ${stackItem.isActive}`;
      })
      .join('\n');
    return `Stack Data:\n${contextString}\n`;
  }

  private async getPipelineRunNodes(type: string) {
    //change back to just step or add artifact command
    let pipelineData = PipelineDataProvider.getInstance().getPipelineData();
    let lsClient = LSClient.getInstance();
    let dagData = await Promise.all(pipelineData.map(async (node: PipelineTreeItem) => {
      let dag = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [node.id]);
      return dag;
    }));

    let stepData = await Promise.all(dagData.map(async (dag: PipelineRunDag) => {
      let filteredNodes = await Promise.all(dag.nodes.map(async (node: DagArtifact|DagStep) => {
        if (type === "all" || node.type === type) {
          return await lsClient.sendLsClientRequest<JsonObject>('getPipelineRunStep', [node.id]);
        }
        return null;
      }));
      return filteredNodes.filter((value) => value !== null);
    }));
    return stepData;
  }

  private async getLogData() {
    let lsClient = LSClient.getInstance();
 
    let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    let apiToken = globalConfig.store.api_token;
    let dashboardUrl = globalConfig.store.url

    if (!apiToken) {
      throw new Error('API Token is not available in gloval configuration');
    }

    let pipelineRunSteps = await this.getPipelineRunNodes('step');
    let logs = await Promise.all(pipelineRunSteps[0].map(async (step) => {
      let response = await axios.get(`${dashboardUrl}/api/v1/steps/${step.id}/logs`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'accept': 'application/json'
        }
      });
      return response.data;
    }));
    return logs;
  }

  private async getPipelineRunLogs(id:string) {
    let lsClient = LSClient.getInstance();

    let dagData = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [id]);

    let stepData = await Promise.all(dagData.nodes.map(async (node: DagArtifact|DagStep) => {
        if (node.type === "step") {
          return await lsClient.sendLsClientRequest<JsonObject>('getPipelineRunStep', [node.id]);
        }
        return null;
      })
    );

    stepData = stepData.filter((value) => value !== null);

    let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    let apiToken = globalConfig.store.api_token;
    let dashboardUrl = globalConfig.store.url

    if (!apiToken) {
      throw new Error('API Token is not available in gloval configuration');
    }

    let logs = await Promise.all(stepData.map(async (step) => {
      let validStep = step as JsonObject;  // Type assertion. If we're not sure if step is not null, should change this to a guard check.
      let response = await axios.get(`${dashboardUrl}/api/v1/steps/${validStep.id}/logs`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'accept': 'application/json'
        }
      });
      return response.data;
    }));
    return logs;
  }
}
