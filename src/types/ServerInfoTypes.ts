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
export interface ServerStatus {
  isConnected: boolean;
  url: string;
  dashboard_url: string;
  version: string;
  store_type: string;
  deployment_type: string;
  database_type: string;
  secrets_store_type: string;
  database?: string;
  backup_directory?: string;
  backup_strategy?: string;
  auth_scheme?: string;
  debug?: boolean;
  id?: string;
  username?: string | null;

  // Added for ZenML 0.80.0 support:
  active_workspace_id?: string;
  active_workspace_name?: string;
  active_project_id?: string;
  active_project_name?: string;
  organization_id?: string;
}

export interface StatusBarServerStatus {
  isConnected: boolean;
  serverUrl: string;
}

/************************************************************************************************
 * This is the object returned by the @LSP_SERVER.command(zenml.serverInfo")
 ************************************************************************************************/
export interface ZenServerDetails {
  storeInfo: ZenServerStoreInfo;
  storeConfig: ZenServerStoreConfig;
}

export interface ConfigUpdateDetails {
  url: string;
  api_token: string;
  store_type: string;
}

/************************************************************************************************
 * This is the response from the `zen_store.get_store_info()` method in the ZenML Client.
 ************************************************************************************************/
export interface ZenServerStoreInfo {
  id: string;
  version: string;
  debug: boolean;
  deployment_type: string;
  database_type: string;
  secrets_store_type: string;
  auth_scheme: string;
  base_url?: string;
  metadata?: any;
  dashboard_url: string;

  // Added for ZenML 0.80.0 support:
  organization_id?: string;
  active_workspace_id?: string;
  active_workspace_name?: string;
  active_project_id?: string;
  active_project_name?: string;
}

/************************************************************************************************
 * This is the response from the `zen_store.get_store_config()` method in the ZenML Client.
 ************************************************************************************************/
export type ZenServerStoreConfig = RestZenServerStoreConfig | SQLZenServerStoreConfig;

/************************************************************************************************
 * REST Zen Server Store Config (type === 'rest')
 ************************************************************************************************/
export interface RestZenServerStoreConfig {
  type: string;
  url: string;
  secrets_store: any;
  backup_secrets_store: any;
  username: string | null;
  password: string | null;
  api_key: any;
  api_token?: string;
  verify_ssl: boolean;
  http_timeout: number;
}

/************************************************************************************************
 * SQL Zen Server Store Config (type === 'sql')
 ************************************************************************************************/
export interface SQLZenServerStoreConfig {
  type: string;
  url: string;
  secrets_store: any;
  backup_secrets_store: any;
  driver: string;
  database: string;
  username: string | null;
  password: string | null;
  ssl_ca: string | null;
  ssl_cert: string | null;
  ssl_key: string | null;
  ssl_verify_server_cert: boolean;
  pool_size: number;
  max_overflow: number;
  pool_pre_ping: boolean;
  backup_strategy: string;
  backup_directory: string;
  backup_database: string | null;
}
