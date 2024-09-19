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

let tokenjs: any;

export async function initializeTokenJS(context: vscode.ExtensionContext, provider: string) {
  const apiKeySecret = `zenml.${provider.toLowerCase()}.key`;
  const apiKey = await context.secrets.get(apiKeySecret);

  if (!apiKey) {
    throw new Error(
      `API key for ${provider} not found. Please set the ${apiKeySecret} in VS Code secrets.`
    );
  }
  const config: Record<string, string> = {};
  config['apiKey'] = apiKey;
  const module = await import('token.js');
  const { TokenJS } = module;
  tokenjs = new TokenJS(config);
}

export async function* getChatResponse(
  messages: ChatMessage[],
  context: string[],
  provider: string,
  model: string
): AsyncGenerator<string, void, unknown> {
  // testing out formatting
  const alans =
    'Format every response to look nice. Add <br><br> between sections for easier readability, and put code in code blocks. You are an assistant that summarizes information, problem solves, or optimizes code.';
  const wills =
    'Format the response using full markdown, create <br><br> between sections and newline characters and use indendation. Obvious JSON, objects, or other code should be in a code block or blockquotes (and make sure to add newline characters when appropriate). Use ordered and unordered lists as much as possible (use <br><br> before lists).';
  const combined = `Format every response to look nice using full markdown. Add <br><br> between sections and use newline characters with indentation where appropriate. Obvious JSON, objects, or other code should be in code blocks or blockquotes, and make sure to add newline characters when needed. Use ordered and unordered lists as much as possible (with <br><br> before lists). You are an assistant that summarizes information, problem solves, or optimizes code.`;
  const optimized = `Format responses using full markdown for readability. Separate sections with <br><br> and use newline characters when needed for clarity. Present all code, JSON, and data structures in code blocks or blockquotes. Use ordered and unordered lists whenever applicable, with spacing before lists. Your role is to summarize information, solve problems, and optimize code.`;
  const revised = `Format every response using full markdown. Add <br><br> between sections for better readability. Use newline characters and indentation where appropriate. Ensure that all JSON, objects, and other code are enclosed in code blocks, and blockquotes when necessary. Before ordered or unordered lists, insert <br><br> for clarity. You are an assistant that summarizes information, solves problems, or optimizes code, ensuring clarity and structure in all responses.`;
  const template = `
  You are a ZenML assistant that summarizes users' ZenML information, problem solves users' ZenML problems, or optimizes users' code in their ZenML pipeline runs.

  Structure (with markdown) the output like this:

  <hr>
  <h2>Category 1</h2>
  <hr>
  <strong>Key 1-1</strong>
  value 1-1
  <br>
  <strong>Key 1-2</strong>
  value 1-2
  <br><br>
  <hr>
  <h2>Category 2</h2>
  <hr>
  <strong>Key 2-1</strong>
  value 2-1
  <br>
  <strong>Key 2-2</strong>
  value 2-2
  
  To bold words, use <b></b> tags. Do not ever use asterisks for formatting.
  To write code blocks, use <code></code> tags.
  if there's an explanation at the end, add it like:

  <br><br>
  <hr>
  <h1>Summary</h1>
  <hr>
  <hr>
  Explanation
  <li>point 1</li>
  <li>point 2</li>
  `;
  if (!tokenjs) {
    throw new Error('TokenJS not initialized');
  }

  console.log(`getChatResponse called with provider: ${provider}, model: ${model}`);

  const fullMessages = [
    { role: 'system', content: template },
    { role: 'user', content: await addContext(context) },
    ...messages,
  ];
  try {
    const stream = await tokenjs.chat.completions.create({
      stream: true,
      provider: provider.toLowerCase(),
      model: model,
      messages: fullMessages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      })),
    });

    for await (const part of stream) {
      if (part.choices[0]?.delta?.content) {
        yield part.choices[0].delta.content;
      }
    }
  } catch (error: any) {
    console.error('Error in getChatResponse:', error);
    throw new Error(`Error with ${provider} API: ${error.message}`);
  }
}

export async function addContext(requestedContext: string[]): Promise<string> {
  let systemMessage = 'Context: ';
  for (let context of requestedContext) {
    switch (context) {
      case 'serverContext':
        systemMessage += getServerData();
        break;
      case 'environmentContext':
        systemMessage += await getEnvironmentData();
        break;
      case 'pipelineContext':
        systemMessage += getPipelineData().contextString;
        systemMessage += '\n A pipeline is a series of steps in a machine learning workflow.';
        break;
      case 'stackContext':
        systemMessage += getStackData();
        break;
      case 'stackComponentsContext':
        systemMessage += getStackComponentData();
        break;
      case 'logsContext':
        systemMessage += await getLogData();
        break;
      default:
        if (context.includes('Pipeline Run:')) {
          let runData = JSON.parse(context.replace('Pipeline Run:', ''));
          let logs = await getPipelineRunLogs(runData.id);
          let nodeData = await getPipelineRunNodes('step', runData.id);
          systemMessage += `Pipeline Run: ${JSON.stringify(runData)}\n`;
          systemMessage += `Logs: ${logs}\n`;
          systemMessage += `Step Data: ${JSON.stringify(nodeData)}\n`;
        }
        break;
    }
  }
  return systemMessage;
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

async function getPipelineRunNodes(type: string, id?: string) {
  let pipelineRuns = PipelineDataProvider.getInstance().getPipelineData();
  let pipelineData;

  if (id) {
    pipelineData = pipelineRuns.filter((pipelineRun) => pipelineRun.id === id);;
  } else {
    pipelineData = pipelineRuns;
  }

  let lsClient = LSClient.getInstance();
  let dagData = await Promise.all(
    pipelineData.map(async node => {
      let dag = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [node.id]);
      return dag;
    })
  );

  let stepData = await Promise.all(
    dagData.map(async (dag: PipelineRunDag) => {
      let filteredNodes = await Promise.all(
        dag.nodes.map(async (node: DagArtifact | DagStep) => {
          if (type === 'all' || node.type === type) {
            return await lsClient.sendLsClientRequest<JsonObject>('getPipelineRunStep', [node.id]);
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

  pipelineRuns.forEach(run => {
    let formattedStartTime = new Date(run.startTime).toLocaleString();
    let formattedEndTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A';

    contextString +=
      `Pipeline Run:\n` +
      `Name: ${run.name}\n` +
      `Status: ${run.status}\n` +
      `Stack Name: ${run.stackName}\n` +
      `Start Time: ${formattedStartTime}\n` +
      `End Time: ${formattedEndTime}\n` +
      `OS: ${run.os} ${run.osVersion}\n` +
      `Python Version: ${run.pythonVersion}\n\n`;

    let stringValue = `Pipeline Run:${JSON.stringify(run)}`;
    let treeItem: TreeItem = {
      name: run.name,
      value: stringValue,
      title: 'Includes all code, logs, and metadata for a specific pipeline run with message',
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

  return { contextString, treeItems };
}

function getPaginatedTreeData(): TreeItem[] {
  let { treeItems } = getPipelineData();
  let paginatedTreeItems = [];
  let pagination = PipelineDataProvider.getInstance().pagination;
  let paginatedTreeItem = { title: "pagination", name: `${pagination.currentPage} of ${pagination.totalPages}`, firstPage: false, lastPage: false };
  
  for (let i = 0; i < treeItems.length; i++) {
    paginatedTreeItems.push(treeItems[i]);
  }

  if (pagination.currentPage === 1) {
    paginatedTreeItem.firstPage = true;
  } else if (pagination.currentPage === pagination.totalPages) {
    paginatedTreeItem.lastPage = true;
  } else {
    paginatedTreeItem.firstPage = false;
    paginatedTreeItem.lastPage = false;
  }

  if (pagination.totalItems > pagination.itemsPerPage) {
    paginatedTreeItems.push(paginatedTreeItem);
  }

  return paginatedTreeItems;
}

export function getTreeData(): TreeItem[] {
  let treeItems = getPaginatedTreeData();
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
