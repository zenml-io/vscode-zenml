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
from typing import Any, Dict, List, Optional, TypedDict
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
    organization_id: str
    organization_name: str


class ListWorkspacesResponse(TypedDict):
    workspaces: List[Workspace]
    total: int
    total_pages: int
    current_page: int
    items_per_page: int


class Project(TypedDict):
    id: str
    name: str
    display_name: Optional[str]
    created: Optional[str]
    updated: Optional[str]


class ListProjectsResponse(TypedDict):
    projects: List[Project]
    total: int
    total_pages: int
    current_page: int
    items_per_page: int


# Projects example response:
# {
#   "index": 1,
#   "max_size": 20,
#   "total_pages": 1,
#   "total": 3,
#   "items": [
#     {
#       "body": {
#         "created": "2025-03-20T08:36:47",
#         "updated": "2025-03-20T08:36:47",
#         "display_name": "first"
#       },
#       "metadata": null,
#       "resources": null,
#       "id": "11e8afc4-f408-4157-b2d3-34fb73f954d4",
#       "permission_denied": false,
#       "name": "first"
#     },
#     {
#       "body": {
#         "created": "2025-03-20T16:26:10",
#         "updated": "2025-03-20T16:26:10",
#         "display_name": "another-project"
#       },
#       "metadata": null,
#       "resources": null,
#       "id": "d7556b75-996e-4d34-827f-ab270b3eb7ec",
#       "permission_denied": false,
#       "name": "another-project"
#     },
#     {
#       "body": {
#         "created": "2025-03-20T16:31:01",
#         "updated": "2025-03-20T16:31:01",
#         "display_name": "third-one for testing"
#       },
#       "metadata": null,
#       "resources": null,
#       "id": "be560b35-1325-463b-8477-bd7baea121ab",
#       "permission_denied": false,
#       "name": "third-one-for-testing"
#     }
#   ]
# }


# ZenML Store Info example response (used in get_server_info):
# {
#   "store_info": {
#     "id": "41597a83-72bc-4252-82e8-e90cde0ebe9a",
#     "name": "default",
#     "version": "0.80.0",
#     "active": true,
#     "debug": true,
#     "deployment_type": "cloud",
#     "database_type": "mysql",
#     "secrets_store_type": "sql",
#     "auth_scheme": "EXTERNAL",
#     "server_url": "https://8dc2e76c-zenml.staging.cloudinfra.zenml.io",
#     "dashboard_url": "https://staging.cloud.zenml.io/workspaces/80",
#     "analytics_enabled": true,
#     "metadata": {
#       "account_id": "678e6a29-2bea-4525-b76f-a30bb5da9d40",
#       "organization_id": "678e6a29-2bea-4525-b76f-a30bb5da9d40",
#       "workspace_id": "41597a83-72bc-4252-82e8-e90cde0ebe9a",
#       "workspace_name": "80"
#     },
#     "last_user_activity": "2025-03-20T17:38:00",
#     "pro_dashboard_url": "https://staging.cloud.zenml.io",
#     "pro_api_url": "https://staging.cloudapi.zenml.io",
#     "pro_organization_id": "678e6a29-2bea-4525-b76f-a30bb5da9d40",
#     "pro_organization_name": "michael",
#     "pro_workspace_id": "41597a83-72bc-4252-82e8-e90cde0ebe9a",
#     "pro_workspace_name": "80"
#   }
# }


# example Workspace object (e.g. one of the items in the raw list_workspaces response):
# {
#   "id": "41597a83-72bc-4252-82e8-e90cde0ebe9a",
#   "name": "80",
#   "description": null,
#   "organization": {
#     "id": "678e6a29-2bea-4525-b76f-a30bb5da9d40",
#     "name": "michael",
#     "description": null,
#     "created": "2024-04-29T12:42:34.729067",
#     "updated": "2025-03-19T13:34:00.318915",
#     "logo_url": null,
#     "owner": {
#       "name": "Michael Schuster",
#       "avatar_url": "https://lh3.googleusercontent.com/a-/ALV-UjU0DELa8HZu-7h-Mex05xgC9bG7XTEwv2jzWAaMblYpr43rH3glCrB9EmkhTTf-ER44brNfrHQ5-YwHA0McT7VJdUTFNkL9qtGR6efWO5L2bVauLx7qioP-uMmm1zX4ouUPyHcHu6Cb2TnNbaNTvAkN6ioZr1jBfjdqMFpJRMi0jmpJL_RLwwB6XcG0dMIjznUC5carADSzOyKQ38k5xiL_1uPAIc3KiYKrIW8WdmmN4-WKG3iguXOREs6qnksPobuNNKXkfZu_0d4PjO71I_2sv88fJ_-wmNd8-z3SDfwe9tVvdQYM2qiOMMY3df7TZks7wxKRPfpexOhlNAAaiw4lb1K57SI_ZO3R_9FXYUoqFUil-ZX3jWZtuGfb6UosJydZZohN1PARK7gjCm4FAERnwRYPM_bWwiHWiF2cD8aM0_XuN-yldujbv7o4CqdQhJZhZFwZF4kINlUzcSNPd92YR1EZ3tMOy5rJmGzs6uGqF9ns4NtPS-9YXRxmUBFqdz92KIRPSg0G0OkO5_mC_ws0OgScGwFUXEkMc3SzDLf7QG3SfkbU0csz0xfEgmP_jJQjy8FwYzWFLBsqMjaKtXrerdUL1M6ifdsKPFwEbbL3hYEsuDGEv-jtre-kHYmbZ7StXNtbYmjJJcEq5NLd9OPRxYxOY6IzeTxFG5OJoxebEUrKfivKU5a8yyBYX8jWw9YexxnWJkaSfUM2U2hrRZXmUOMrMFc50YyEh3G-QHuMx6_7ngR4wbOUAQIv5FTo5Qyk27_jcPkqyr3RiHyEccfILSvss2bukq7KAp-C6o3DFcSo3BGfq5jne80n1aODlo3jVwtrJbH81aE8RsK_D46cpF1SgweAqiXb2BNRE34-KxZjMRemkbuAIhKo9zz_S7xZMElyzDU3Bjc76tUOIpXYegOZEVqFu1RM8RICBgNpzTeeZPJNUtoHW3ljBGuM6ea4vVRhXibQxOonfstkdhKYIiU=s96-c",
#       "company": null,
#       "job_title": null,
#       "metadata": {
#         "newsletter": false,
#         "work_email": "michael@zenml.io",
#         "primary_use": "personal",
#         "usage_reason": "implementing_production_environment",
#         "infra_providers": ["local"],
#         "finished_onboarding_survey": true
#       },
#       "password": null,
#       "password_expired": null,
#       "email": "michael@zenml.io",
#       "oauth_provider": "google-oauth2",
#       "oauth_id": "104783105129105489083",
#       "id": "73144f24-5214-40e9-b004-b412db5a6565",
#       "is_active": true,
#       "is_superuser": false
#     },
#     "has_active_subscription": null,
#     "trial_expiry": null
#   },
#   "desired_state": "available",
#   "state_reason": "user_action",
#   "status": "available",
#   "zenml_service": {
#     "configuration": {
#       "version": "0.80.0",
#       "analytics_enabled": true,
#       "secrets_store": {
#         "type": "sql"
#       },
#       "backup_secrets_store": null,
#       "admin": {
#         "provider_type": "argocd",
#         "service_tier": "basic",
#         "resources": {
#           "replicas": 1,
#           "cpu": "100m",
#           "memory": "450Mi",
#           "max_memory": "800Mi",
#           "autoscaling_enabled": false,
#           "thread_pool_size": 20,
#           "db_pool_size": 10,
#           "db_pool_overflow": -1
#         }
#       }
#     },
#     "status": {
#       "server_url": "https://8dc2e76c-zenml.staging.cloudinfra.zenml.io",
#       "version": "0.80.0"
#     }
#   },
#   "display_name": "0.80.0",
#   "logo_url": null,
#   "owner": {
#     "name": "Michael Schuster",
#     "avatar_url": "https://lh3.googleusercontent.com/a-/ALV-UjU0DELa8HZu-7h-Mex05xgC9bG7XTEwv2jzWAaMblYpr43rH3glCrB9EmkhTTf-ER44brNfrHQ5-YwHA0McT7VJdUTFNkL9qtGR6efWO5L2bVauLx7qioP-uMmm1zX4ouUPyHcHu6Cb2TnNbaNTvAkN6ioZr1jBfjdqMFpJRMi0jmpJL_RLwwB6XcG0dMIjznUC5carADSzOyKQ38k5xiL_1uPAIc3KiYKrIW8WdmmN4-WKG3iguXOREs6qnksPobuNNKXkfZu_0d4PjO71I_2sv88fJ_-wmNd8-z3SDfwe9tVvdQYM2qiOMMY3df7TZks7wxKRPfpexOhlNAAaiw4lb1K57SI_ZO3R_9FXYUoqFUil-ZX3jWZtuGfb6UosJydZZohN1PARK7gjCm4FAERnwRYPM_bWwiHWiF2cD8aM0_XuN-yldujbv7o4CqdQhJZhZFwZF4kINlUzcSNPd92YR1EZ3tMOy5rJmGzs6uGqF9ns4NtPS-9YXRxmUBFqdz92KIRPSg0G0OkO5_mC_ws0OgScGwFUXEkMc3SzDLf7QG3SfkbU0csz0xfEgmP_jJQjy8FwYzWFLBsqMjaKtXrerdUL1M6ifdsKPFwEbbL3hYEsuDGEv-jtre-kHYmbZ7StXNtbYmjJJcEq5NLd9OPRxYxOY6IzeTxFG5OJoxebEUrKfivKU5a8yyBYX8jWw9YexxnWJkaSfUM2U2hrRZXmUOMrMFc50YyEh3G-QHuMx6_7ngR4wbOUAQIv5FTo5Qyk27_jcPkqyr3RiHyEccfILSvss2bukq7KAp-C6o3DFcSo3BGfq5jne80n1aODlo3jVwtrJbH81aE8RsK_D46cpF1SgweAqiXb2BNRE34-KxZjMRemkbuAIhKo9zz_S7xZMElyzDU3Bjc76tUOIpXYegOZEVqFu1RM8RICBgNpzTeeZPJNUtoHW3ljBGuM6ea4vVRhXibQxOonfstkdhKYIiU=s96-c",
#     "email": "michael@zenml.io",
#     "is_active": true,
#     "is_superuser": false
#   },
#   "created": "2025-03-20T08:31:19.506841",
#   "updated": "2025-03-20T08:33:33.817353",
#   "status_updated": "2025-03-20T08:33:33.817353"
# }
