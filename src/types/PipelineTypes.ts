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

export interface PipelineRunsData {
  runs: PipelineRun[];
  total: number;
  total_pages: number;
  current_page: number;
  items_per_page: number;
}

export interface PipelineRunStep {
  status: string;
  start_time?: string;
  end_time?: string;
  id?: string;
}

export interface PipelineRunConfig {
  enable_cache?: boolean;
  enable_artifact_metadata?: boolean;
  enable_artifact_visualization?: boolean;
  enable_step_logs?: boolean;
  name?: string;
  model?: PipelineModel;
}

export interface PipelineModel {
  name: string;
  description?: string;
  tags?: string[];
  version?: string;
  save_models_to_registry?: boolean;
  license?: string;
}

export interface PipelineRun {
  id: string;
  name: string;
  status: string;
  stackName: string;
  startTime: string;
  endTime: string;
  pipelineName: string;
  runMetadata?: Record<string, any>;
  config?: PipelineRunConfig;
  steps?: {
    [stepName: string]: PipelineRunStep;
  } | null; // Steps may be null in optimized responses
}

export interface DagStep {
  id: string;
  type: 'step';
  data: {
    execution_id: string;
    name: string;
    status: 'initializing' | 'failed' | 'completed' | 'running' | 'cached';
  };
}

export interface DagArtifact {
  id: string;
  type: 'artifact';
  data: {
    execution_id: string;
    name: string;
    artifact_type: string;
  };
}

export type DagNode = DagStep | DagArtifact;

export interface DagEdge {
  id: string;
  source: string;
  target: string;
}

export interface PipelineRunDag {
  nodes: Array<DagNode>;
  edges: Array<DagEdge>;
  status: string;
  name: string;
  message?: string; // Optional message when step data is not available
}

export type PipelineRunsResponse = PipelineRunsData | ErrorMessageResponse | VersionMismatchError;
