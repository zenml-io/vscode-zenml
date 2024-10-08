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

import { ErrorMessageResponse, VersionMismatchError } from './LSClientResponseTypes';

/************************************************************************************************
 * LSClient parses the JSON response from the ZenML Client, and returns the following types.
 * Hydrated types are in the HydratedTypes.ts file.
 ************************************************************************************************/
interface StacksData {
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
  flavor: string;
  type: string;
  config: { [key: string]: any };
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
  logo_url: string;
  config_schema: { [key: string]: any };
  docs_url: string | null;
  sdk_docs_url: string | null;
  connector_type: string | null;
  connector_resource_type: string | null;
  connector_resource_id_attr: string | null;
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
  Stack,
  Components,
  StackComponent,
  StacksData,
  ComponentsListData,
  Flavor,
  ComponentTypes,
};
