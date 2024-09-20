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
import { PipelineDataProvider } from '../../activityBar';
import { TreeItem } from '../../../types/ChatTypes';

export function getPipelineData(): { contextString: string; treeItems: TreeItem[] } {
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
}

export function getPaginatedTreeData(): TreeItem[] {
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