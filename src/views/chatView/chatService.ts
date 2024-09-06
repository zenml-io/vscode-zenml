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
import * as vscode from 'vscode';
import axios from 'axios';
import {
  PipelineDataProvider,
  PipelineRunTreeItem,
  PipelineTreeItem,
  ServerDataProvider,
  StackDataProvider,
  StackComponentTreeItem,
} from '../activityBar';
import { ComponentDataProvider } from '../activityBar/componentView/ComponentDataProvider';
import { EnvironmentDataProvider } from '../activityBar/environmentView/EnvironmentDataProvider';
import { LSClient } from '../../services/LSClient';
import { DagArtifact, DagStep, PipelineRunDag } from '../../types/PipelineTypes';
import { JsonObject } from '../panel/panelView/PanelTreeItem';
import { ZenmlGlobalConfigResp } from '../../types/LSClientResponseTypes';
import { TreeItem } from 'vscode';
import { ChatMessage } from '../../types/ChatTypes';

export class ChatService {
  private static instance: ChatService;
  private tokenjs: any;
  private context: vscode.ExtensionContext;
  private providers: Record<string, string> = {
    'claude-3-5-sonnet-20240620': 'anthropic',
    'claude-3-opus-20240229': 'anthropic',
    'gpt-4o': 'openai',
    'gemini-1.5-pro': 'gemini',
    'gemini-1.5-flash': 'gemini',
  };

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
      let provider = 'Gemini'; // this is the only provider available at the moment
      const apiKey = await this.context.secrets.get(`zenml.${provider.toLowerCase()}.key`);
      if (!apiKey) {
        vscode.window.showErrorMessage('No Gemini API key found. Please register one');
      }
      this.tokenjs = new TokenJS({ apiKey });
    } catch (error) {
      console.error('Error loading TokenJS:', error);
      vscode.window.showErrorMessage(
        `Failed to initialize ChatService: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async *getChatResponse(
    messages: ChatMessage[],
    context: string[]
  ): AsyncGenerator<string, void, unknown> {
    try {
      if (context) {
        messages = await this.addContext(messages, context);
      }

      const completion = await this.tokenjs.chat.completions.create({
        streaming: true,
        provider: this.providers[context[0]] ?? '',
        model: context[0] ?? '',
        messages: messages,
      });

      if (Symbol.asyncIterator in completion) {
        for await (const part of completion) {
          yield part.choices[0]?.delta?.content || '';
        }
      } else if (completion.choices && completion.choices.length > 0) {
        yield completion.choices[0].message.content || '';
      } else {
        throw new Error('Unexpected response from API');
      }
    } catch (error) {
      console.error('Error with Gemini API:', error);
      if (error instanceof Error) {
        yield `Error: ${error.message}. Please check your API key and network connection.`;
      } else {
        yield 'Error: An unexpected error occurred while getting a response from Gemini.';
      }
    }
  }

  private async addContext(
    messages: ChatMessage[],
    requestedContext: any[]
  ): Promise<ChatMessage[]> {
    let systemMessage: ChatMessage = { role: 'system', content: 'Context: ' };
    for (let context of requestedContext) {
      // TODO possibly create interface for context, change requestContext type (currently any[])
      switch (context) {
        case 'serverContext':
          systemMessage.content += this.getServerData();
          break;
        case 'environmentContext':
          systemMessage.content += await this.getEnvironmentData();
          break;
        case 'pipelineContext':
          systemMessage.content += this.getPipelineData();
          break;
        case 'stackContext':
          systemMessage.content += this.getStackData();
          break;
        case 'stackComponentsContext':
          systemMessage.content += this.getStackComponentData();
          break;
        default:
          if (context.includes('Pipeline run:')) {
            systemMessage.content += context;
            context = JSON.parse(context.replace('Pipeline run:', ''));
            let logs = await this.getPipelineRunLogs(context.id);
            let nodeData = await this.getPipelineRunNodes('step');
            systemMessage.content += `Step Data: ${JSON.stringify(nodeData)}`;
            systemMessage.content += `Logs: ${logs}`;
          }
          break;
      }
    }
    messages.push(systemMessage);
    return messages;
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

  private async getEnvironmentData(): Promise<string> {
    let environmentData = await EnvironmentDataProvider.getInstance().getChildren();
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
    let dagData = await Promise.all(
      pipelineData.map(async (node: PipelineTreeItem) => {
        let dag = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [
          node.id,
        ]);
        return dag;
      })
    );

    let stepData = await Promise.all(
      dagData.map(async (dag: PipelineRunDag) => {
        let filteredNodes = await Promise.all(
          dag.nodes.map(async (node: DagArtifact | DagStep) => {
            if (type === 'all' || node.type === type) {
              return await lsClient.sendLsClientRequest<JsonObject>('getPipelineRunStep', [
                node.id,
              ]);
            }
            return null;
          })
        );
        return filteredNodes.filter(value => value !== null);
      })
    );
    return stepData;
  }

  private async getLogData() {
    let lsClient = LSClient.getInstance();

    let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    let apiToken = globalConfig.store.api_token;
    let dashboardUrl = globalConfig.store.url;

    if (!apiToken) {
      throw new Error('API Token is not available in global configuration');
    }

    let pipelineRunSteps = await this.getPipelineRunNodes('step');

    let logs = await Promise.all(
      pipelineRunSteps[0].map(async step => {
        if (step && step.id) {
          try {
            let response = await axios.get(`${dashboardUrl}/api/v1/steps/${step.id}/logs`, {
              headers: {
                Authorization: `Bearer ${apiToken}`,
                accept: 'application/json',
              },
            });
            return response.data;
          } catch (error) {
            console.error(`Failed to get logs for step with id ${step.id}`, error);
          }
        } else {
          console.warn('Encountered a null or invalid step.');
        }
      })
    );
    return logs;
  }

  private async getPipelineRunLogs(id: string) {
    let lsClient = LSClient.getInstance();

    let dagData = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [id]);

    let stepData = await Promise.all(
      dagData.nodes.map(async (node: DagArtifact | DagStep) => {
        if (node.type === 'step') {
          return await lsClient.sendLsClientRequest<JsonObject>('getPipelineRunStep', [node.id]);
        }
        return null;
      })
    );

    stepData = stepData.filter(value => value !== null);

    let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    let apiToken = globalConfig.store.api_token;
    let dashboardUrl = globalConfig.store.url;

    if (!apiToken) {
      throw new Error('API Token is not available in global configuration');
    }

    let logs = await Promise.all(
      stepData.map(async step => {
        if (step && typeof step === 'object' && 'id' in step) {
          let validStep = step as JsonObject;
          let response = await axios.get(`${dashboardUrl}/api/v1/steps/${validStep.id}/logs`, {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              accept: 'application/json',
            },
          });
          return response.data;
        }
        return null; // returns null if step is invalid
      })
    );
    logs = logs.filter(log => log !== null); // Filters out possible null logs.
    return logs;
  }

  private async getMetadata() {
    let lsClient = LSClient.getInstance();

    let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    let apiToken = globalConfig.store.api_token;
    let dashboardUrl = globalConfig.store.url;

    if (!apiToken) {
      throw new Error('API Token is not available in global configuration');
    }

    // Grabs a list of metadata IDs
    // Eventually should be reformatted to grab individual metadata based on the metadata ID
    let metadata = await axios.get(`${dashboardUrl}/api/v1/run-metadata`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        accept: 'application/json',
      },
    });
  }
}
