#  Copyright (c) ZenML GmbH 2024. All Rights Reserved.
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at:
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
#  or implied. See the License for the specific language governing
#  permissions and limitations under the License.
from typing import Any, Dict, List, Optional, Set, Tuple, TypedDict, Union
from uuid import UUID

MetadataType = Union[
    str,
    int,
    float,
    bool,
    Dict[Any, Any],
    List[Any],
    Set[Any],
    Tuple[Any, ...],
]


class StepArtifactBody(TypedDict):
    type: str
    artifact: Dict[str, str]


class StepArtifact(TypedDict):
    id: UUID
    body: StepArtifactBody


class GraphNode(TypedDict):
    id: str
    type: str
    data: Dict[str, str]


class GraphEdge(TypedDict):
    id: str
    source: str
    target: str


class GraphResponse(TypedDict):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    name: str
    status: str
    version: str


class ErrorResponse(TypedDict):
    error: str


class RunStepResponse(TypedDict):
    name: str
    id: str
    status: str
    author: Dict[str, str]
    startTime: Optional[str]
    endTime: Optional[str]
    duration: Optional[str]
    stackName: str
    orchestrator: Dict[str, str]
    pipeline: Dict[str, str]
    cacheKey: str
    sourceCode: str
    logsUri: str


class RunArtifactResponse(TypedDict):
    name: str
    version: str
    id: str
    type: str
    author: Dict[str, str]
    update: str
    data: Dict[str, str]
    metadata: Dict[str, Any]


class ZenmlStoreInfo(TypedDict):
    id: str
    version: str
    debug: bool
    deployment_type: str
    database_type: str
    secrets_store_type: str
    auth_scheme: str
    server_url: str
    dashboard_url: str


class ZenmlStoreConfig(TypedDict):
    type: str
    url: str
    api_token: Optional[str]


class ZenmlServerInfoResp(TypedDict):
    store_info: ZenmlStoreInfo
    store_config: ZenmlStoreConfig


class ZenmlGlobalConfigResp(TypedDict):
    user_id: str
    user_email: str
    analytics_opt_in: bool
    version: str
    active_stack_id: str
    active_workspace_name: str
    store: ZenmlStoreConfig


class StackComponent(TypedDict):
    id: str
    name: str
    flavor: str
    type: str
    config: Dict[str, Any]


class ListComponentsResponse(TypedDict):
    index: int
    max_size: int
    total_pages: int
    total: int
    items: List[StackComponent]


class Flavor(TypedDict):
    id: str
    name: str
    type: str
    logo_url: str
    config_schema: Dict[str, Any]
    docs_url: Optional[str]
    sdk_docs_url: Optional[str]
    connector_type: Optional[str]
    connector_resource_type: Optional[str]
    connector_resource_id_attr: Optional[str]


class ListFlavorsResponse(TypedDict):
    index: int
    max_size: int
    total_pages: int
    total: int
    items: List[Flavor]


class Workspace(TypedDict):
    id: str
    name: str
    description: Optional[str]
    display_name: Optional[str]
    organization_id: str
    organization_name: str
    status: str
    zenml_version: str
    zenml_server_url: str
    dashboard_url: str
    dashboard_organization_url: str


class ListWorkspacesResponse(TypedDict):
    workspaces: List[Workspace]
    total: int
    offset: int
    limit: int


class Project(TypedDict):
    id: str
    name: str
    display_name: Optional[str]
    created: Optional[str]
    updated: Optional[str]
    metadata: Optional[MetadataType]


class ListProjectsResponse(TypedDict):
    projects: List[Project]
    total: int
    total_pages: int
    current_page: int
    items_per_page: int
