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
import { error } from 'console';

type ContextType =
  | 'serverContext'
  | 'environmentContext'
  | 'pipelineContext'
  | 'stackContext'
  | 'stackComponentsContext'
  | 'logsContext'
  | 'pipelineRunContext'
  | string;

export async function addContext(requestedContext: ContextType[]): Promise<string> {
  let systemMessage = 'Context:\n';
  for (let context of requestedContext) {
    if (context.startsWith('Pipeline Run:')) {
      try {
        let runData = JSON.parse(context.replace('Pipeline Run:', ''));
        let logs = await getPipelineRunLogs(runData.id);
        let nodeData = await getPipelineRunNodes('step', runData.id);
        systemMessage += `Pipeline Run: ${JSON.stringify(runData)}\n`;
        systemMessage += `Logs: ${logs}\n`;
        systemMessage += `Step Data: ${JSON.stringify(nodeData)}\n`;
      } catch (error) {
        console.error('Failed to parse pipeline run data from context:', error);
        systemMessage += 'Failed to parse pipeline run data from context.\n';
      }
    } else {
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
          console.warn(`Unknown context type: ${context}`);
          systemMessage += `Unknown context type: ${context}\n`;
          break;
      }
    }
  }
  return systemMessage;
}

function getServerData(): string {
  try {
    let serverData = ServerDataProvider.getInstance().getCurrentStatus();
    return `Server Status Data:\n${JSON.stringify(serverData)}\n`;
  } catch (error) {
    console.error('Failed to get server status:', error);
    return 'Server Status Data: Unable to retrieve\n';
  }
}

function getStackComponentData(): string {
  try {
    let components = ComponentDataProvider.getInstance().items;
    let componentData = components
      .map((item: vscode.TreeItem) => {
        if (item instanceof StackComponentTreeItem) {
          let { name, type, flavor, id } = item.component;
          let stackId = item.stackId;
          let idInfo = stackId ? ` - Stack ID: ${stackId}` : '';
          let componentId = ` - Component ID: ${id}`;
          return `Name: ${name}, Type: ${type}, Flavor: ${flavor}${componentId}${idInfo}`;
        } else if (item.label) {
          return `Label: ${item.label}, Description: ${item.description || 'N/A'}`;
        } else {
          return 'Unknown item type';
        }
      })
      .join('\n');
    return `Stack Component Data:\n${componentData}\n`;
  } catch (error) {
    console.error('Failed to get stack component data:', error);
    return 'Stack Component Data: Unable to retrieve\n';
  }
}

async function getEnvironmentData(): Promise<string> {
  try {
    let environmentData = await EnvironmentDataProvider.getInstance().getChildren();
    let contextString = environmentData
      .map(item => `${item.label}: ${item.description || ''}`)
      .join('\n');
    return `Environment Data:\n${contextString}\n`;
  } catch (error) {
    console.error('Failed to get environment data:', error);
    return 'Environment Data: Unable to retrieve\n';
  }
}

function getStackData(): string {
  try {
    let stackData = StackDataProvider.getInstance().items;
    let contextString = stackData
      .map(item => {
        if ('isActive' in item && 'id' in item) {
          return `Name: ${item.label || 'N/A'}\n` + `ID: ${item.id}\n` + `Active: ${item.isActive}`;
        }
        return `Name: ${item.label || 'N/A'}`;
      })
      .join('\n');
    return `Stack Data:\n${contextString}\n`;
  } catch (error) {
    console.error('Failed to get stack data:', error);
    return 'Stack Data: Unable to retrieve\n';
  }
}

async function getLogData(): Promise<any[]> {
  try {
    const lsClient = LSClient.getInstance();

    const globalConfig =
      await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    if (!globalConfig.store) {
      throw new Error('Global configuration store is undefined');
    }

    const apiToken = globalConfig.store.api_token;
    if (!apiToken) {
      throw new Error('API Token is not available in global configuration');
    }

    const dashboardUrl = globalConfig.store.url;
    if (!dashboardUrl) {
      throw new Error('Dashboard URL is not available in global configuration');
    }

    const pipelineRunSteps = await getPipelineRunNodes('step');

    if (!pipelineRunSteps?.[0]) {
      console.warn('No pipeline run steps found.');
      return [];
    }

    const fetchStepLogs = async (step: any) => {
      if (!step?.id) {
        console.warn('Encountered a null or invalid step.');
        return null;
      }
      try {
        const response = await axios.get(`${dashboardUrl}/api/v1/steps/${step.id}/logs`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            accept: 'application/json',
          },
        });
        return response.data;
      } catch (error) {
        console.error(`Failed to get logs for step with id ${step.id}`, error);
        return null;
      }
    };

    const logs = await Promise.all(pipelineRunSteps[0].map(fetchStepLogs));
    return logs.filter(log => log !== null);
  } catch (error) {
    console.error('Failed to retrieve log data:', error);
    return [];
  }
}

type Step = {
  id: string;
  [key: string]: any;
};

async function fetchLogs(stepId: string, apiToken: string, dashboardUrl: string): Promise<any> {
  try {
    const response = await axios.get(`${dashboardUrl}/api/v1/steps/${stepId}/logs`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        accept: 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to get logs for step with id ${stepId}`, error);
    return null;
  }
}

async function getPipelineRunLogs(id: string): Promise<any[]> {
  try {
    const lsClient = LSClient.getInstance();
    const dagData = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [id]);

    const stepData = (
      await Promise.all(
        dagData.nodes.map(async (node: DagArtifact | DagStep) => {
          if (node.type === 'step') {
            return await lsClient.sendLsClientRequest<Step>('getPipelineRunStep', [node.id]);
          }
          return null;
        })
      )
    ).filter((step): step is Step => step !== null);

    const globalConfig =
      await lsClient.sendLsClientRequest<ZenmlGlobalConfigResp>('getGlobalConfig');
    const apiToken = globalConfig.store.api_token;
    const dashboardUrl = globalConfig.store.url;

    if (!apiToken) {
      throw new Error('API Token is not available in global configuration');
    }

    const logs = await Promise.all(
      stepData.map(step => fetchLogs(step.id, apiToken, dashboardUrl))
    );

    return logs.filter(log => log !== null);
  } catch (error) {
    console.error('Failed to retrieve pipeline run logs:', error);
    return [];
  }
}

type NodeType = 'all' | 'step' | 'artifact';

async function getPipelineRunNodes(
  nodeType: NodeType,
  pipelineRunId?: string
): Promise<JsonObject[][]> {
  try {
    const pipelineDataProvider = PipelineDataProvider.getInstance();
    const allPipelineRuns = pipelineDataProvider.getPipelineData();
    const targetPipelineRuns = pipelineRunId
      ? allPipelineRuns.filter(run => run.id === pipelineRunId)
      : allPipelineRuns;

    const lsClient = LSClient.getInstance();

    const fetchAndFilterNodes = async (pipelineRun: { id: string }): Promise<JsonObject[]> => {
      const dag = await lsClient.sendLsClientRequest<PipelineRunDag>('getPipelineRunDag', [
        pipelineRun.id,
      ]);

      const filteredNodes = await Promise.all(
        dag.nodes.map(async (node: DagArtifact | DagStep) => {
          if (nodeType === 'all' || node.type === nodeType) {
            return await lsClient.sendLsClientRequest<JsonObject>('getPipelineRunStep', [node.id]);
          }
          return null;
        })
      );

      return filteredNodes.filter((node): node is JsonObject => node !== null);
    };

    const pipelineNodesData = await Promise.all(targetPipelineRuns.map(fetchAndFilterNodes));
    return pipelineNodesData;
  } catch (error) {
    console.error('Failed to retrieve pipeline run nodes:', error);
    return [];
  }
}
