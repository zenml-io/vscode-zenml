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
// or implied. See the License for the specific language governing
// permissions and limitations under the License.
import * as vscode from 'vscode';
import { DeploymentInvokeResponse, DeploymentOperationResponse } from '../../types/DeploymentTypes';
import { DeploymentDataProvider } from '../../views/activityBar/deploymentView/DeploymentDataProvider';
import { DeploymentTreeItem } from '../../views/activityBar/deploymentView/DeploymentTreeItems';
import DeploymentLogPanel from './DeploymentLogPanel';
import {
  deleteDeployment as deleteDeploymentRequest,
  deprovisionDeployment as deprovisionDeploymentRequest,
  getDeploymentDashboardUrl,
  invokeDeployment as invokeDeploymentRequest,
  provisionDeployment as provisionDeploymentRequest,
  refreshDeploymentStatus as refreshDeploymentStatusRequest,
} from './utils';

const deploymentOutputChannel = vscode.window.createOutputChannel('ZenML Deployments');

const isVersionMismatchResponse = (
  result: any
): result is { clientVersion: string; serverVersion: string } => {
  return Boolean(result && 'clientVersion' in result && 'serverVersion' in result);
};

const getErrorMessage = (
  result: DeploymentOperationResponse | DeploymentInvokeResponse
): string | undefined => {
  if (!result) {
    return 'No response from server.';
  }

  if (isVersionMismatchResponse(result)) {
    return `Client version ${result.clientVersion} is incompatible with server version ${result.serverVersion}.`;
  }

  if ('error' in result && result.error) {
    return result.error;
  }

  if ('success' in result && result.success === false) {
    return 'message' in result ? result.message : 'Operation failed.';
  }

  return undefined;
};

const getDeploymentLabel = (node: DeploymentTreeItem): string => {
  if (typeof node.label === 'string') {
    return node.label;
  }

  return node.deployment?.name || 'deployment';
};

const getPreferredDeploymentUrl = (node: DeploymentTreeItem): string => {
  return node.deployment.url || getDeploymentDashboardUrl(node.deployment.id);
};

const showOutput = (title: string, lines: string[]): void => {
  deploymentOutputChannel.clear();
  if (title) {
    deploymentOutputChannel.appendLine(title);
    deploymentOutputChannel.appendLine('');
  }
  lines.forEach(line => deploymentOutputChannel.appendLine(line));
  deploymentOutputChannel.show(true);
};

const refreshDeploymentView = async (): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
    },
    async () => {
      await DeploymentDataProvider.getInstance().refresh();
    }
  );
};

const provisionDeployment = async (node: DeploymentTreeItem): Promise<void> => {
  const deploymentName = getDeploymentLabel(node);
  const answer = await vscode.window.showWarningMessage(
    `Provision deployment ${deploymentName}?`,
    { modal: true },
    'Provision'
  );

  if (answer !== 'Provision') {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Provisioning deployment ${deploymentName}...`,
    },
    async () => {
      try {
        const result = await provisionDeploymentRequest(node.deployment.id);
        const errorMessage = getErrorMessage(result);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        if ('message' in result && result.message) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showInformationMessage(`Deployment ${deploymentName} provisioned.`);
        }

        await refreshDeploymentView();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to provision deployment: ${error.message ?? error}`);
      }
    }
  );
};

const deprovisionDeployment = async (node: DeploymentTreeItem): Promise<void> => {
  const deploymentName = getDeploymentLabel(node);
  const answer = await vscode.window.showWarningMessage(
    `Deprovision deployment ${deploymentName}?`,
    { modal: true },
    'Deprovision'
  );

  if (answer !== 'Deprovision') {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Deprovisioning deployment ${deploymentName}...`,
    },
    async () => {
      try {
        const result = await deprovisionDeploymentRequest(node.deployment.id);
        const errorMessage = getErrorMessage(result);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        if ('message' in result && result.message) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showInformationMessage(`Deployment ${deploymentName} deprovisioned.`);
        }

        await refreshDeploymentView();
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to deprovision deployment: ${error.message ?? error}`
        );
      }
    }
  );
};

const deleteDeployment = async (node: DeploymentTreeItem): Promise<void> => {
  const deploymentName = getDeploymentLabel(node);
  const answer = await vscode.window.showWarningMessage(
    `Are you sure you want to delete ${deploymentName}? This cannot be undone.`,
    { modal: true },
    'Delete'
  );

  if (answer !== 'Delete') {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Deleting deployment ${deploymentName}...`,
    },
    async () => {
      try {
        const result = await deleteDeploymentRequest(node.deployment.id);
        const errorMessage = getErrorMessage(result);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        if ('message' in result && result.message) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showInformationMessage(`Deployment ${deploymentName} deleted.`);
        }

        await refreshDeploymentView();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to delete deployment: ${error.message ?? error}`);
      }
    }
  );
};

const refreshDeploymentStatus = async (node: DeploymentTreeItem): Promise<void> => {
  const deploymentName = getDeploymentLabel(node);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Refreshing status for ${deploymentName}...`,
    },
    async () => {
      try {
        const result = await refreshDeploymentStatusRequest(node.deployment.id);
        const errorMessage = getErrorMessage(result);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        if ('message' in result && result.message) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showInformationMessage(
            `Deployment status refreshed for ${deploymentName}.`
          );
        }

        await refreshDeploymentView();
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to refresh deployment status: ${error.message ?? error}`
        );
      }
    }
  );
};

const copyDeploymentUrl = async (node: DeploymentTreeItem): Promise<void> => {
  const url = getPreferredDeploymentUrl(node);
  if (!url) {
    vscode.window.showWarningMessage('No deployment URL available to copy.');
    return;
  }

  await vscode.env.clipboard.writeText(url);
  vscode.window.showInformationMessage('Deployment URL copied to clipboard.');
};

const openDeploymentUrl = (node: DeploymentTreeItem): void => {
  const url = getPreferredDeploymentUrl(node);
  if (!url) {
    vscode.window.showWarningMessage('No deployment URL available to open.');
    return;
  }

  try {
    const parsedUrl = vscode.Uri.parse(url);
    vscode.env.openExternal(parsedUrl);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open deployment URL: ${error}`);
  }
};

const viewDeploymentLogs = async (node: DeploymentTreeItem): Promise<void> => {
  try {
    await DeploymentLogPanel.getInstance().show(node);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to open deployment logs: ${errorMessage}`);
  }
};

const invokeDeployment = async (node: DeploymentTreeItem): Promise<void> => {
  const deploymentName = getDeploymentLabel(node);
  const payloadInput = await vscode.window.showInputBox({
    prompt: 'Enter JSON payload for deployment invocation (optional)',
    placeHolder: '{"key": "value"}',
    value: '{}',
  });

  if (payloadInput === undefined) {
    return;
  }

  let payload: Record<string, unknown> = {};
  const trimmedInput = payloadInput.trim();
  if (trimmedInput.length > 0) {
    try {
      const parsed = JSON.parse(trimmedInput);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        vscode.window.showErrorMessage('Invocation payload must be a JSON object.');
        return;
      }
      payload = parsed as Record<string, unknown>;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Invalid JSON: ${error.message ?? error}`);
      return;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Invoking deployment ${deploymentName}...`,
    },
    async () => {
      try {
        const result = await invokeDeploymentRequest(node.deployment.id, payload);
        const errorMessage = getErrorMessage(result);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        if (!('response' in result)) {
          throw new Error('Invocation response missing.');
        }

        const executionInfo =
          typeof result.executionTime === 'number'
            ? `Execution time: ${result.executionTime}`
            : 'Execution completed.';
        const responseBody = JSON.stringify(result.response ?? {}, null, 2);

        showOutput(`Deployment Invocation: ${deploymentName}`, [executionInfo, '', responseBody]);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to invoke deployment: ${error.message ?? error}`);
      }
    }
  );
};

export const deploymentCommands = {
  refreshDeploymentView,
  provisionDeployment,
  deprovisionDeployment,
  deleteDeployment,
  refreshDeploymentStatus,
  copyDeploymentUrl,
  openDeploymentUrl,
  viewDeploymentLogs,
  invokeDeployment,
};
