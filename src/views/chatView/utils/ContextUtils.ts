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
import { PipelineDataProvider, ServerDataProvider, StackDataProvider } from '../../activityBar';
import { LSClient } from '../../../services/LSClient';
import { ZenmlGlobalConfigResp } from '../../../types/LSClientResponseTypes';
import { PipelineRunDag, DagStep, DagArtifact } from '../../../types/PipelineTypes';
import { JsonObject } from '../../panel/panelView/PanelTreeItem';
import { StackComponentTreeItem } from '../../activityBar';
import axios from 'axios';
import * as vscode from 'vscode';
import { getPipelineData } from './PipelineUtils';
import { ComponentDataProvider } from '../../activityBar/componentView/ComponentDataProvider';
import { EnvironmentDataProvider } from '../../activityBar/environmentView/EnvironmentDataProvider';

export async function addContext(requestedContext: string[]): Promise<string> {
  let systemMessage = 'Context:\n';
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

async function getLogData() {
  let lsClient = LSClient.getInstance();

  let globalConfig = await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
  let apiToken = globalConfig.store.api_token;
  let dashboardUrl = globalConfig.store.url;

  if (!apiToken) {
    throw new Error('API Token is not available in global configuration');
  }

  let pipelineRunSteps = await getPipelineRunNodes('step');

  if (pipelineRunSteps && pipelineRunSteps[0]) {
    let logs = await Promise.all(
      pipelineRunSteps[0].map(async step => {
        if (step?.id) {
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
  } else {
    console.warn('No pipeline run steps found.');
    return [];
  }
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
        try {
          let response = await axios.get(`${dashboardUrl}/api/v1/steps/${validStep.id}/logs`, {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              accept: 'application/json',
            },
          });
          return response.data;
        } catch (error) {
          console.error(`Failed to get logs for step with id ${validStep.id}`, error);
          return null;
        }
      }
      return null;
    })
  );
  logs = logs.filter(log => log !== null);
  return logs;
}

async function getPipelineRunNodes(type: string, id?: string) {
  let pipelineRuns = PipelineDataProvider.getInstance().getPipelineData();
  let pipelineData;

  if (id) {
    pipelineData = pipelineRuns.filter(pipelineRun => pipelineRun.id === id);
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
