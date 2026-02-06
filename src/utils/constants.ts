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
import { ServerStatus } from '../types/ServerInfoTypes';

export const PYTOOL_MODULE = 'zenml-python';
export const PYTOOL_DISPLAY_NAME = 'ZenML';
export const LANGUAGE_SERVER_NAME = 'zen-language-server';
export const MIN_ZENML_VERSION = '0.80.0';
export const ZENML_EMOJI = '⛩️';

export const ZENML_PYPI_URL = 'https://pypi.org/pypi/zenml/json';
export const DEFAULT_LOCAL_ZENML_SERVER_URL = 'http://127.0.0.1:8237';
export const BASE_CLOUD_ZENML_SERVER_URL = 'https://cloudapi.zenml.io';

// LSP server notifications
export const LSP_IS_ZENML_INSTALLED = 'zenml/isInstalled';
export const LSP_ZENML_CLIENT_INITIALIZED = 'zenml/clientInitialized';
export const LSP_ZENML_SERVER_CHANGED = 'zenml/serverChanged';
export const LSP_ZENML_STACK_CHANGED = 'zenml/stackChanged';
export const LSP_ZENML_PROJECT_CHANGED = 'zenml/projectChanged';
export const LSP_ZENML_REQUIREMENTS_NOT_MET = 'zenml/requirementsNotMet';

// EventBus emitted events
export const LSCLIENT_READY = 'lsClientReady';
export const LSCLIENT_STATE_CHANGED = 'lsClientStateChanged';
export const ZENML_CLIENT_STATE_CHANGED = 'zenmlClientStateChanged';

export const REFRESH_ENVIRONMENT_VIEW = 'refreshEnvironmentView';

export const SERVER_STATUS_UPDATED = 'serverStatusUpdated';
export const ITEMS_PER_PAGE_OPTIONS = ['5', '10', '15', '20', '25', '30', '35', '40', '45', '50'];

// Analytics constants
export const ANALYTICS_ENDPOINT = 'https://analytics.zenml.io/batch';
export const ANALYTICS_SOURCE_CONTEXT = 'vscode';
export const ANALYTICS_ANONYMOUS_ID_KEY = 'zenml.analyticsAnonymousId';
export const ANALYTICS_FIRST_ACTIVATED_KEY = 'zenml.analyticsFirstActivatedAt';
export const ANALYTICS_TRACK = 'analyticsTrack';

// Analytics-related EventBus events (internal plumbing, not Segment event names)
export const ENVIRONMENT_INFO_UPDATED = 'environmentInfoUpdated';
export const SERVER_DISCONNECT_REQUESTED = 'serverDisconnectRequested';

export const INITIAL_ZENML_SERVER_STATUS: ServerStatus = {
  isConnected: false,
  url: '',
  dashboard_url: '',
  store_type: '',
  deployment_type: '',
  version: '',
  debug: false,
  database_type: '',
  secrets_store_type: '',
  username: null,
};
