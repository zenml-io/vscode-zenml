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

import { ErrorMessageResponse, VersionMismatchError } from './LSClientResponseTypes';

/**
 * Deployment status values matching ZenML's DeploymentStatus enum.
 * - unknown: Status cannot be determined
 * - pending: Deployment is being provisioned
 * - running: Deployment is active and serving requests
 * - absent: Deployment exists but is not provisioned
 * - error: Deployment encountered an error
 */
export type DeploymentStatus = 'unknown' | 'pending' | 'running' | 'absent' | 'error';

/**
 * Snapshot information for a deployment's pipeline snapshot.
 */
export interface DeploymentSnapshot {
  id: string;
  name: string;
  createdAt: string | null;
  version: string | null;
}

/**
 * Core deployment interface representing a ZenML deployment.
 * Deployments are long-running HTTP services that wrap pipelines for real-time execution.
 */
export interface Deployment {
  id: string;
  name: string;
  url: string | null;
  status: DeploymentStatus;
  pipelineName: string | null;
  snapshot: DeploymentSnapshot | null;
  stackName: string | null;
  deployerName: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  userName: string | null;
}

/**
 * Paginated response data for deployment listings.
 */
export interface DeploymentsData {
  deployments: Deployment[];
  total: number;
  total_pages: number;
  current_page: number;
  items_per_page: number;
}

/**
 * Union type for deployment list responses, including error cases.
 */
export type DeploymentsResponse = DeploymentsData | ErrorMessageResponse | VersionMismatchError;

/**
 * Response structure for deployment logs.
 */
export interface DeploymentLogsData {
  logs: string[];
  deploymentId: string;
  deploymentName: string;
}

export type DeploymentLogsResponse =
  | DeploymentLogsData
  | ErrorMessageResponse
  | VersionMismatchError;

/**
 * Response for single deployment operations (provision, deprovision, delete).
 */
export interface DeploymentOperationResult {
  success: boolean;
  message: string;
  deploymentId: string;
}

export type DeploymentOperationResponse =
  | DeploymentOperationResult
  | ErrorMessageResponse
  | VersionMismatchError;

/**
 * Response for deployment invocation.
 */
export interface DeploymentInvokeResult {
  success: boolean;
  response: Record<string, unknown>;
  executionTime: number;
}

export type DeploymentInvokeResponse =
  | DeploymentInvokeResult
  | ErrorMessageResponse
  | VersionMismatchError;
