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
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ServerStatus, ZenServerDetails } from '../../../types/ServerStatusTypes';

export const MOCK_CONTEXT = {
  subscriptions: [],
  extensionUri: vscode.Uri.parse('file:///extension/path'),
  storagePath: '/path/to/storage',
  globalStoragePath: '/path/to/global/storage',
  workspaceState: { get: sinon.stub(), update: sinon.stub() },
  globalState: { get: sinon.stub(), update: sinon.stub(), setKeysForSync: sinon.stub() },
  logPath: '/path/to/log',
  asAbsolutePath: sinon.stub(),
} as any;

export const MOCK_REST_SERVER_STATUS: ServerStatus = {
  isConnected: true,
  id: 'test-server',
  store_type: 'rest',
  url: 'https://zenml.example.com',
  version: '0.55.5',
  debug: false,
  deployment_type: 'kubernetes',
  database_type: 'sqlite',
  secrets_store_type: 'sql',
  auth_scheme: 'OAUTH2_PASSWORD_BEARER',
};

export const MOCK_REST_SERVER_DETAILS: ZenServerDetails = {
  storeInfo: {
    id: 'test-server',
    version: '0.55.5',
    debug: false,
    deployment_type: 'kubernetes',
    database_type: 'sqlite',
    secrets_store_type: 'sql',
    auth_scheme: 'OAUTH2_PASSWORD_BEARER',
  },
  storeConfig: {
    type: 'rest',
    url: 'https://zenml.example.com',
    secrets_store: null,
    backup_secrets_store: null,
    username: null,
    password: null,
    api_key: 'api_key',
    verify_ssl: true,
    pool_pre_ping: true,
    http_timeout: 30,
  },
};

export const MOCK_SQL_SERVER_STATUS: ServerStatus = {
  isConnected: false,
  id: 'test-server',
  store_type: 'sql',
  url: 'sqlite:///path/to/sqlite.db',
  version: '0.55.5',
  debug: false,
  deployment_type: 'local',
  database_type: 'sqlite',
  secrets_store_type: 'sql',
  auth_scheme: 'OAUTH2_PASSWORD_BEARER',
};

export const MOCK_SQL_SERVER_DETAILS: ZenServerDetails = {
  storeInfo: {
    id: 'test-server',
    version: '0.55.5',
    debug: false,
    deployment_type: 'local',
    database_type: 'sqlite',
    secrets_store_type: 'sql',
    auth_scheme: 'OAUTH2_PASSWORD_BEARER',
  },
  storeConfig: {
    type: 'sql',
    url: 'sqlite:///path/to/sqlite.db',
    secrets_store: null,
    backup_secrets_store: null,
    username: null,
    password: null,
    verify_ssl: false,
    pool_pre_ping: true,
    http_timeout: 30,
    driver: '',
    database: '',
    ssl_ca: '',
    ssl_key: '',
    ssl_verify_server_cert: false,
    ssl_cert: '',
    pool_size: 0,
    max_overflow: 0,
    backup_strategy: '',
    backup_directory: '',
    backup_database: '',
  },
};
