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
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ServerStatus, ZenServerDetails } from '../../../types/ServerInfoTypes';

export const MOCK_REST_SERVER_URL = 'https://zenml.example.com';
export const MOCK_SQL_SERVER_URL = 'sqlite:///path/to/sqlite.db';
export const MOCK_SERVER_ID = 'test-server';
export const MOCK_AUTH_SCHEME = 'OAUTH2_PASSWORD_BEARER';
export const MOCK_ZENML_VERSION = '0.63.0';
export const MOCK_ACCESS_TOKEN = 'valid_token';

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
  id: MOCK_SERVER_ID,
  store_type: 'rest',
  url: MOCK_REST_SERVER_URL,
  version: MOCK_ZENML_VERSION,
  debug: false,
  deployment_type: 'kubernetes',
  database_type: 'sqlite',
  secrets_store_type: 'sql',
  auth_scheme: MOCK_AUTH_SCHEME,
  dashboard_url: '',
};

export const MOCK_REST_SERVER_DETAILS: ZenServerDetails = {
  storeInfo: {
    id: MOCK_SERVER_ID,
    version: MOCK_ZENML_VERSION,
    debug: false,
    deployment_type: 'kubernetes',
    database_type: 'sqlite',
    secrets_store_type: 'sql',
    auth_scheme: MOCK_AUTH_SCHEME,
    dashboard_url: '',
  },
  storeConfig: {
    type: 'rest',
    url: MOCK_REST_SERVER_URL,
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
  id: MOCK_SERVER_ID,
  store_type: 'sql',
  url: MOCK_SQL_SERVER_URL,
  version: MOCK_ZENML_VERSION,
  debug: false,
  deployment_type: 'local',
  database_type: 'sqlite',
  secrets_store_type: 'sql',
  auth_scheme: MOCK_AUTH_SCHEME,
  dashboard_url: '',
};

export const MOCK_SQL_SERVER_DETAILS: ZenServerDetails = {
  storeInfo: {
    id: MOCK_SERVER_ID,
    version: MOCK_ZENML_VERSION,
    debug: false,
    deployment_type: 'local',
    database_type: 'sqlite',
    secrets_store_type: 'sql',
    auth_scheme: MOCK_AUTH_SCHEME,
    dashboard_url: '',
  },
  storeConfig: {
    type: 'sql',
    url: MOCK_SQL_SERVER_URL,
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
