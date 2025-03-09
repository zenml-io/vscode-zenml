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
import { format } from 'date-fns';
import { PipelineDataProvider } from '../../activityBar';
import { TreeItem, ContextItem } from '../../../types/ChatTypes';

const CONTEXT_ITEMS: readonly ContextItem[] = [
  { name: 'Server', value: 'serverContext', title: 'Includes all server metadata with message' },
  {
    name: 'Environment',
    value: 'environmentContext',
    title: 'Includes all environment metadata with message',
  },
  { name: 'Stack', value: 'stackContext', title: 'Includes all stack metadata with message' },
  {
    name: 'Stack Components',
    value: 'stackComponentsContext',
    title: 'Includes all stack component metadata with message',
  },
] as const;

export function getPipelineData(): { contextString: string; treeItems: TreeItem[] } {
  try {
    const pipelineRuns = PipelineDataProvider.getInstance().getPipelineRuns();
    let contextString = '';
    const treeItems: TreeItem[] = [];

    pipelineRuns.forEach(run => {
      const formattedStartTime = format(new Date(run.startTime), 'Pp');
      const formattedEndTime = run.endTime ? format(new Date(run.endTime), 'Pp') : 'N/A';

      contextString +=
        `Pipeline Run:\n` +
        `Name: ${run.name}\n` +
        `Status: ${run.status}\n` +
        `Stack Name: ${run.stackName}\n` +
        `Start Time: ${formattedStartTime}\n` +
        `End Time: ${formattedEndTime}\n` +
        `OS: ${run.os} ${run.osVersion}\n` +
        `Python Version: ${run.pythonVersion}\n\n`;

      const stringValue = `Pipeline Run:${JSON.stringify(run)}`;
      const treeItem: TreeItem = {
        name: run.name,
        value: stringValue,
        title: 'Includes all code, logs, and metadata for a specific pipeline run with message',
        children: [
          { name: `<b>run name:</b> ${run.name}` },
          { name: `<b>status:</b> ${run.status}` },
          { name: `<b>stack:</b> ${run.stackName}` },
          { name: `<b>start time:</b> ${formattedStartTime}` },
          { name: `<b>end time:</b> ${formattedEndTime}` },
          { name: `<b>os:</b> ${run.os} ${run.osVersion}` },
          { name: `<b>python version:</b> ${run.pythonVersion}` },
        ],
      };
      treeItems.push(treeItem);
    });

    return { contextString, treeItems };
  } catch (error) {
    console.error('Error fetching pipeline data:', error);
    return { contextString: '', treeItems: [] };
  }
}

export function getPaginatedTreeData(): TreeItem[] {
  try {
    const { treeItems } = getPipelineData();
    const paginatedTreeItems = [...treeItems];
    const pagination = PipelineDataProvider.getInstance().pagination;
    const paginatedTreeItem = {
      title: 'pagination',
      name: `${pagination.currentPage} of ${pagination.totalPages}`,
      firstPage: pagination.currentPage === 1,
      lastPage: pagination.currentPage === pagination.totalPages,
    };

    if (pagination.totalItems > pagination.itemsPerPage) {
      paginatedTreeItems.push(paginatedTreeItem);
    }

    return paginatedTreeItems;
  } catch (error) {
    console.error('Error fetching paginated tree data:', error);
    return [];
  }
}

export function getTreeData(): TreeItem[] {
  try {
    const paginatedItems = getPaginatedTreeData();
    return [
      ...CONTEXT_ITEMS,
      {
        name: 'Pipeline Runs',
        value: 'pipelineContext',
        title: 'Includes all code, logs, and metadata for pipeline runs with message',
        children: paginatedItems,
      },
    ];
  } catch (error) {
    console.error('Error fetching tree data: ', error);
    return [...CONTEXT_ITEMS];
  }
}
