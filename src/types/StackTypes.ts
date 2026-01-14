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
import { JsonObject, JsonValue } from './JsonTypes';

/************************************************************************************************
 * LSClient parses the JSON response from the ZenML Client, and returns the following types.
 * Hydrated types are in the HydratedTypes.ts file.
 ************************************************************************************************/

type ComponentConfig = JsonObject;

type FlavorConfigSchemaType =
  | 'string'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'number'
  | 'null';

interface FlavorConfigProperty {
  title?: string;
  description?: string;
  type?: FlavorConfigSchemaType;
  default?: JsonValue;
  anyOf?: Array<{ type?: FlavorConfigSchemaType }>;
}

interface FlavorConfigSchema {
  title?: string;
  description?: string;
  properties?: Record<string, FlavorConfigProperty>;
  required?: string[];
}

interface StacksData {
  active_stack: Stack;
  stacks: Stack[];
  total: number;
  total_pages: number;
  current_page: number;
  items_per_page: number;
}

interface Stack {
  id: string;
  name: string;
  components: Components;
}

interface Components {
  [componentType: string]: StackComponent[];
}

interface StackComponent {
  id: string;
  name: string;
  flavor: Flavor;
  type: string;
  config: ComponentConfig;
}

export type StacksResponse = StacksData | ErrorMessageResponse | VersionMismatchError;

interface ComponentsListData {
  index: number;
  max_size: number;
  total_pages: number;
  total: number;
  items: Array<StackComponent>;
}

export type ComponentsListResponse =
  | ComponentsListData
  | ErrorMessageResponse
  | VersionMismatchError;

interface Flavor {
  id: string;
  name: string;
  type: string;
  integration: string | null;
  source: string | null;
  logo_url: string;
  config_schema: FlavorConfigSchema;
  docs_url: string | null;
  sdk_docs_url: string | null;
  connector_type: string | null;
  connector_resource_type: string | null;
  connector_resource_id_attr: string | null;
  created: string | null;
  updated: string | null;
  is_custom: boolean;
}

interface FlavorListData {
  index: number;
  max_size: number;
  total_pages: number;
  total: number;
  items: Flavor[];
}

export type FlavorListResponse = FlavorListData | ErrorMessageResponse | VersionMismatchError;

type ComponentTypes = string[];

export type ComponentTypesResponse = ComponentTypes | VersionMismatchError | ErrorMessageResponse;

export {
  ComponentConfig,
  Components,
  ComponentsListData,
  ComponentTypes,
  Flavor,
  FlavorConfigSchema,
  FlavorConfigProperty,
  Stack,
  StackComponent,
  StacksData,
};
