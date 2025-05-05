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

export interface ModelUser {
  id?: string;
  name: string;
  is_service_account?: boolean;
  full_name?: string;
  email_opted_in?: boolean;
  is_admin?: boolean;
}

export interface ModelTag {
  name: string;
}

export interface Model {
  id?: string;
  name: string;
  latest_version_name?: string;
  user?: ModelUser;
  tags: string[];
}

export interface ModelsData {
  index: number;
  max_size: number;
  total_pages: number;
  total: number;
  items: Model[];
}

export interface ModelVersionModel {
  id: string;
  name: string;
  tags: string[];
  user?: ModelUser;
}

export interface ModelVersion {
  id: string;
  name: string;
  created: string;
  updated: string;
  stage: string | null;
  number: number;
  model: ModelVersionModel;
  data_artifact_ids?: {
    [key: string]: {
      [key: string]: string;
    };
  };
  model_artifact_ids?: {
    [key: string]: {
      [key: string]: string;
    };
  };
  pipeline_run_ids?: {
    [key: string]: string;
  };
  tags: ModelTag[];
}

export interface ModelVersionsData {
  index: number;
  max_size: number;
  total_pages: number;
  total: number;
  items: ModelVersion[];
}

export type ModelsResponse = ModelsData | ErrorMessageResponse | VersionMismatchError;
export type ModelVersionsResponse = ModelVersionsData | ErrorMessageResponse | VersionMismatchError;
