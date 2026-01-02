/*
Copyright(c) ZenML GmbH 2024. All Rights Reserved.
Licensed under the Apache License, Version 2.0(the \"License\");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an \"AS IS\" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied. See the License for the specific language governing
permissions and limitations under the License.
*/
import * as vscode from 'vscode';
import { Deployment, DeploymentSnapshot, DeploymentStatus } from '../../../types/DeploymentTypes';
import { CONTEXT_VALUES, DEPLOYMENT_STATUS_ICONS, TREE_ICONS } from '../../../utils/ui-constants';

type DeploymentDetailType =
  | 'link'
  | 'pipeline'
  | 'snapshot'
  | 'stack'
  | 'deployer'
  | 'owner'
  | 'created'
  | 'updated'
  | 'status';

const DEPLOYMENT_STATUS_CONTEXT: Record<DeploymentStatus, string> = {
  running: CONTEXT_VALUES.DEPLOYMENT_RUNNING,
  pending: CONTEXT_VALUES.DEPLOYMENT_PENDING,
  error: CONTEXT_VALUES.DEPLOYMENT_ERROR,
  absent: CONTEXT_VALUES.DEPLOYMENT_ABSENT,
  unknown: CONTEXT_VALUES.DEPLOYMENT_UNKNOWN,
};

const DEPLOYMENT_DETAIL_ICONS: Record<DeploymentDetailType, vscode.ThemeIcon> = {
  link: TREE_ICONS.LINK,
  pipeline: TREE_ICONS.PIPELINE,
  snapshot: TREE_ICONS.VERSIONS,
  stack: TREE_ICONS.STACK,
  deployer: TREE_ICONS.ROCKET,
  owner: TREE_ICONS.ACCOUNT,
  created: TREE_ICONS.CLOCK,
  updated: TREE_ICONS.CLOCK,
  status: TREE_ICONS.DEPLOYMENT,
};

const formatOptionalValue = (value: string | null | undefined, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const formatSnapshotInfo = (snapshot: DeploymentSnapshot | null): string => {
  if (!snapshot) {
    return 'None';
  }
  const snapshotName = formatOptionalValue(snapshot.name || snapshot.id, 'Unknown');
  const snapshotVersion = formatOptionalValue(snapshot.version, 'Unknown');
  const snapshotCreatedAt = formatOptionalValue(snapshot.createdAt, 'Unknown');
  return `${snapshotName} (version: ${snapshotVersion}, created: ${snapshotCreatedAt})`;
};

const formatOwner = (deployment: Deployment): string => {
  return formatOptionalValue(deployment.userName ?? deployment.userId, 'Unknown');
};

/**
 * A TreeItem for displaying a deployment in the VSCode TreeView.
 * This item can be expanded to show deployment details.
 */
export class DeploymentTreeItem extends vscode.TreeItem {
  public children?: vscode.TreeItem[];

  constructor(
    public readonly deployment: Deployment,
    children?: vscode.TreeItem[]
  ) {
    const hasChildren = Array.isArray(children) && children.length > 0;
    super(
      deployment.name,
      hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.children = children;
    this.id = deployment.id;
    this.description = deployment.status;
    this.contextValue =
      DEPLOYMENT_STATUS_CONTEXT[deployment.status] ?? CONTEXT_VALUES.DEPLOYMENT_UNKNOWN;
    this.iconPath = DEPLOYMENT_STATUS_ICONS[deployment.status] ?? TREE_ICONS.DEPLOYMENT;

    const tooltipLines: string[] = [
      `**Deployment: ${deployment.name}**`,
      '',
      `**Status:** ${deployment.status}`,
    ];

    if (deployment.status === 'running' && deployment.url) {
      tooltipLines.push('', `**URL:** [${deployment.url}](${deployment.url})`);
    }

    tooltipLines.push(
      '',
      `**Pipeline:** ${formatOptionalValue(deployment.pipelineName, 'None')}`,
      `**Snapshot:** ${formatSnapshotInfo(deployment.snapshot)}`,
      `**Stack:** ${formatOptionalValue(deployment.stackName, 'None')}`,
      `**Deployer:** ${formatOptionalValue(deployment.deployerName, 'None')}`,
      `**Owner:** ${formatOwner(deployment)}`,
      `**Created:** ${formatOptionalValue(deployment.createdAt, 'Unknown')}`,
      `**Updated:** ${formatOptionalValue(deployment.updatedAt, 'Unknown')}`
    );

    this.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));
  }
}

/**
 * Represents a deployment detail Tree Item in the VS Code tree view.
 */
export class DeploymentDetailTreeItem extends vscode.TreeItem {
  public children?: DeploymentDetailTreeItem[];

  constructor(
    public readonly label: string,
    public readonly description: string,
    detailType: DeploymentDetailType,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.contextValue = CONTEXT_VALUES.DEPLOYMENT_DETAIL;
    this.iconPath = DEPLOYMENT_DETAIL_ICONS[detailType] ?? TREE_ICONS.DETAIL;
  }
}
