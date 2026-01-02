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
import { LSClient } from '../../services/LSClient';
import {
  DeploymentInvokeResponse,
  DeploymentLogsResponse,
  DeploymentOperationResponse,
} from '../../types/DeploymentTypes';
import { ServerDataProvider } from '../../views/activityBar';
import { buildWorkspaceProjectUrl, getBaseUrl, isServerStatus } from '../server/utils';

const sendDeploymentCommand = async <T>(command: string, args: unknown[]): Promise<T> => {
  const lsClient = LSClient.getInstance();
  return lsClient.sendLsClientRequest<T>(command, args);
};

export const getDeploymentDashboardUrl = (id: string): string => {
  if (!id) {
    return '';
  }

  const serverStatus = ServerDataProvider.getInstance().getCurrentStatus();
  if (!isServerStatus(serverStatus) || serverStatus.deployment_type === 'other') {
    return '';
  }

  const baseUrl = getBaseUrl(serverStatus.dashboard_url);
  const suffix = `/deployments/${id}`;
  return buildWorkspaceProjectUrl(baseUrl, serverStatus, suffix);
};

export const provisionDeployment = async (
  deploymentId: string
): Promise<DeploymentOperationResponse> => {
  return sendDeploymentCommand<DeploymentOperationResponse>('provisionDeployment', [deploymentId]);
};

export const deprovisionDeployment = async (
  deploymentId: string
): Promise<DeploymentOperationResponse> => {
  return sendDeploymentCommand<DeploymentOperationResponse>('deprovisionDeployment', [
    deploymentId,
  ]);
};

export const deleteDeployment = async (
  deploymentId: string
): Promise<DeploymentOperationResponse> => {
  return sendDeploymentCommand<DeploymentOperationResponse>('deleteDeployment', [deploymentId]);
};

export const refreshDeploymentStatus = async (
  deploymentId: string
): Promise<DeploymentOperationResponse> => {
  return sendDeploymentCommand<DeploymentOperationResponse>('refreshDeploymentStatus', [
    deploymentId,
  ]);
};

export const invokeDeployment = async (
  deploymentId: string,
  payload: Record<string, unknown>
): Promise<DeploymentInvokeResponse> => {
  return sendDeploymentCommand<DeploymentInvokeResponse>('invokeDeployment', [
    deploymentId,
    payload,
  ]);
};

export const getDeploymentLogs = async (deploymentId: string): Promise<DeploymentLogsResponse> => {
  return sendDeploymentCommand<DeploymentLogsResponse>('getDeploymentLogs', [deploymentId]);
};

const deploymentUtils = {
  getDeploymentDashboardUrl,
  provisionDeployment,
  deprovisionDeployment,
  deleteDeployment,
  refreshDeploymentStatus,
  invokeDeployment,
  getDeploymentLogs,
};

export default deploymentUtils;
