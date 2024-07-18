from typing import Any, TypedDict, Dict, List, Union
from uuid import UUID

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
    startTime: Union[str, None]
    endTime: Union[str, None]
    duration: Union[str, None]
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
    api_token: Union[str, None]

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

class ComponentResponse(TypedDict):
    id: str
    name: str
    flavor: str
    type: str

class ListComponentsResponse(TypedDict):
    index: int
    max_size: int
    total_pages: int
    total: int
    items: List[ComponentResponse]