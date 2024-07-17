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