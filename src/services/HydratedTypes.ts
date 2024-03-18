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

/************************************************************************************************
 * Hydrated User types from the ZenML Client.
 ************************************************************************************************/
interface User {
  body: UserBody;
  metadata?: UserMetadata;
  resources?: null;
  id: string;
  permission_denied: boolean;
  name: string;
}

interface UserMetadata {
  email?: string | null;
  hub_token?: string | null;
  external_user_id?: string | null;
}

interface UserBody {
  created: string;
  updated: string;
  active: boolean;
  activation_token?: null;
  full_name?: string;
  email_opted_in?: null;
  is_service_account: boolean;
}

/************************************************************************************************
 * Hydrated Workspace types from the ZenML Client.
 ************************************************************************************************/
interface Workspace {
  body: WorkspaceBody;
  metadata?: {
    description?: string;
  };
  resources?: any | null;
  id: string;
  permission_denied: boolean;
  name: string;
}

interface WorkspaceBody {
  created: string;
  updated: string;
}

interface Workspace {
  body: WorkspaceBody;
  metadata?: {
    description?: string;
  };
  resources?: any | null;
  id: string;
  permission_denied: boolean;
  name: string;
}

interface WorkspaceBody {
  created: string;
  updated: string;
}

/************************************************************************************************
 * Hydrated Stack / Components types from the ZenML Client.
 ************************************************************************************************/
interface HydratedStack {
  id: string;
  name: string;
  permission_denied: boolean;
  body: {
    created: string;
    updated: string;
    user?: User | null;
  };
  metadata: StackMetadata;
  resources?: null;
}

interface HydratedStackComponent {
  body: StackComponentBody;
  metadata: ComponentMetadata;
  resources?: null;
  id: string;
  permission_denied: boolean;
  name: string;
}

interface StackComponentBody {
  created: string;
  updated: string;
  user?: User | null;
  type: string;
  flavor: string;
}

interface ComponentMetadata {
  workspace: Workspace;
  configuration?: any;
  labels?: null;
  component_spec_path?: null;
  connector_resource_id?: null;
  connector?: null;
}

interface StackMetadata {
  workspace: Workspace;
  components: HydratedComponents;
  description: string;
  stack_spec_path?: null;
}

interface HydratedComponents {
  orchestrator?: HydratedStackComponent[];
  artifact_store?: HydratedStackComponent[];
  container_registry?: HydratedStackComponent[];
  model_registry?: HydratedStackComponent[];
  step_operator?: HydratedStackComponent[];
  feature_store?: HydratedStackComponent[];
  model_deployer?: HydratedStackComponent[];
  experiment_tracker?: HydratedStackComponent[];
  alerter?: HydratedStackComponent[];
  annotator?: HydratedStackComponent[];
  data_validator?: HydratedStackComponent[];
  image_builder?: HydratedStackComponent[];
}

export { Workspace, WorkspaceBody, User, UserBody, UserMetadata };
