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
import { ServerStatus } from '../types/ServerInfoTypes';

export const PYTOOL_MODULE = 'zenml-python';
export const MIN_ZENML_VERSION = '0.55.2';
export const ZENML_PYPI_URL = 'https://pypi.org/pypi/zenml/json';
export const DEFAULT_LOCAL_ZENML_SERVER_URL = 'http://127.0.0.1:8237';

export const INITIAL_ZENML_SERVER_STATUS: ServerStatus = {
  isConnected: false,
  url: '',
  store_type: '',
  deployment_type: '',
  version: '',
  debug: false,
  database_type: '',
  secrets_store_type: '',
  username: null,
};

export const PIPELINE_RUN_STATUS_ICONS: Record<string, string> = {
  initializing: 'loading~spin',
  failed: 'error',
  completed: 'check',
  running: 'sync~spin',
  cached: 'history',
};
