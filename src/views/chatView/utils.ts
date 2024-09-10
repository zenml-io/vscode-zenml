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
import { ChatMessage, TreeItem } from '../../types/ChatTypes';
import { PipelineDataProvider, ServerDataProvider, StackDataProvider } from '../activityBar';
import { ComponentDataProvider } from '../activityBar/componentView/ComponentDataProvider';
import { EnvironmentDataProvider } from '../activityBar/environmentView/EnvironmentDataProvider';
import { LSClient } from '../../services/LSClient';
import { ZenmlGlobalConfigResp } from '../../types/LSClientResponseTypes';
import { PipelineRunDag, DagArtifact, DagStep } from '../../types/PipelineTypes';
import { JsonObject } from '../panel/panelView/PanelTreeItem';
import { StackComponentTreeItem } from '../activityBar';

const providers: Record<string, string> = {
  'claude-3-5-sonnet-20240620': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'gpt-4o': 'openai',
  'gemini-1.5-pro': 'gemini',
  'gemini-1.5-flash': 'gemini',
};

let tokenjs: any;

export async function initializeTokenJS(context: vscode.ExtensionContext) {
  try {
    const module = await import('token.js');
    const { TokenJS } = module;
    let provider = 'Gemini';
    const apiKey = await context.secrets.get(`zenml.${provider.toLowerCase()}.key`);
    if (!apiKey) {
      vscode.window.showErrorMessage('No Gemini API key found. Please register one');
    }
    tokenjs = new TokenJS({ apiKey });
  } catch (error) {
    console.error('Error loading TokenJS:', error);
    vscode.window.showErrorMessage(
      `Failed to initialize ChatService: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function* getChatResponse(
  messages: ChatMessage[],
  context: string[]
): AsyncGenerator<string, void, unknown> {
  try {
    const systemMessage: ChatMessage = { 
      role: 'system', 
      content:
        "Format every response to look nice. Add <br><br> between sections for easier readability, and put code in code blocks. You are an assistant that summarizes information, problem solves, or optimizes code."
      };
    messages.push(systemMessage);
    if (context) {
      messages = await addContext(messages, context);
    }

    const completion = await tokenjs.chat.completions.create({
      streaming: true,
      provider: providers[context[0]] ?? '',
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

async function addContext(messages: ChatMessage[], requestedContext: any[]): Promise<ChatMessage[]> {
  let systemMessage: ChatMessage = { role: 'system', content: 'Context: ' };
  for (let context of requestedContext) {
    switch (context) {
      case 'serverContext':
        systemMessage.content += getServerData();
        break;
      case 'environmentContext':
        systemMessage.content += await getEnvironmentData();
        break;
      case 'pipelineContext':
        systemMessage.content += getPipelineData();
        systemMessage.content += "\n A pipeline is a series of steps in a machine learning workflow.";
        break;
      case 'stackContext':
        systemMessage.content += getStackData();
        break;
      case 'stackComponentsContext':
        systemMessage.content += getStackComponentData();
        break;
      case 'logsContext':
        systemMessage.content += await getLogData();
        break;
      default:
        if (context.includes('Pipeline run:')) {
          systemMessage.content += context;
          context = JSON.parse(context.replace('Pipeline run:', ''));
          let logs = await getPipelineRunLogs(context.id);
          let nodeData = await getPipelineRunNodes('step');
          systemMessage.content += `Step Data: ${JSON.stringify(nodeData)}`;
          systemMessage.content += `Logs: ${logs}`;
        }
        break;
    }
  }
  messages.push(systemMessage);
  return messages;
}

function getServerData(): string {
  let serverData = ServerDataProvider.getInstance().getCurrentStatus();
  return `Server Status Data:\n${JSON.stringify(serverData)}\n`;
}

function getStackComponentData(): string {
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

async function getEnvironmentData(): Promise<string> {
  let environmentData = await EnvironmentDataProvider.getInstance().getChildren();
  let contextString = environmentData
    .map(item => `${item.label}: ${item.description || ''}`)
    .join('\n');
  return `Environment Data:\n${contextString}\n`;
}

function getStackData(): string {
  let stackData = StackDataProvider.getInstance().items;
  let contextString = stackData
    .map(item => {
      let stackItem = item as vscode.TreeItem & { isActive: boolean; id: string };
      return `Name: ${item.label}\n` + `ID: ${stackItem.id}\n` + `Active: ${stackItem.isActive}`;
    })
    .join('\n');
  return `Stack Data:\n${contextString}\n`;
}

async function getPipelineRunNodes(type: string) {
  let pipelineData = PipelineDataProvider.getInstance().getPipelineData();
  let lsClient = LSClient.getInstance();
  let dagData = await Promise.all(
    pipelineData.map(async node => {
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

async function getLogData() {
  let lsClient = LSClient.getInstance();

  let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
  let apiToken = globalConfig.store.api_token;
  let dashboardUrl = globalConfig.store.url;

  if (!apiToken) {
    throw new Error('API Token is not available in global configuration');
  }

  let pipelineRunSteps = await getPipelineRunNodes('step');

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

async function getPipelineRunLogs(id: string) {
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
      return null;
    })
  );
  logs = logs.filter(log => log !== null);
  return logs;
}

function getPipelineData(): { contextString: string; treeItems: TreeItem[] } {
    let pipelineRuns = PipelineDataProvider.getInstance().pipelineRuns;
    let contextString = '';
    let treeItems: TreeItem[] = [];

    pipelineRuns.forEach((run, index) => {
        let formattedStartTime = new Date(run.startTime).toLocaleString();
        let formattedEndTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A';
        
        contextString += `Pipeline Run:\n` +
        `Name: ${run.name}\n` +
        `Status: ${run.status}\n` +
        `Stack Name: ${run.stackName}\n` +
        `Start Time: ${formattedStartTime}\n` +
        `End Time: ${formattedEndTime}\n` +
        `OS: ${run.os} ${run.osVersion}\n` +
        `Python Version: ${run.pythonVersion}\n\n`;

        let stringValue = `Pipeline run:${JSON.stringify(run)}`;
        let treeItem: TreeItem = {
        name: run.name,
        value: stringValue,
        title: 'Includes all code, logs, and metadata for a specific pipeline run with message',
        hidden: index > 9,
        children: [
            { name: run.status },
            { name: run.stackName },
            { name: formattedStartTime },
            { name: formattedEndTime },
            { name: `${run.os} ${run.osVersion}` },
            { name: run.pythonVersion },
        ],
        };
        treeItems.push(treeItem);
    });

    if (treeItems.length > 9) {
        treeItems.push({ name: 'Expand' });
    }

    return { contextString, treeItems };
}

export function getTreeData(): TreeItem[] {
    let { contextString, treeItems } = getPipelineData();
    let treeData: TreeItem[] = [
        {
        name: 'Server',
        value: 'serverContext',
        title: 'Includes all server metadata with message',
        },
        {
        name: 'Environment',
        value: 'environmentContext',
        title: 'Includes all server metadata with message',
        },
        {
        name: 'Pipeline Runs',
        value: 'pipelineContext',
        title: 'Includes all code, logs, and metadata for pipeline runs with message',
        children: treeItems,
        },
        { name: 'Stack', value: 'stackContext', title: 'Includes all stack metadata with message' },
        {
        name: 'Stack Components',
        value: 'stackComponentsContext',
        title: 'Includes all stack component metadata with message',
        },
    ];
    return treeData;
}