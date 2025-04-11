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
"""This module provides wrappers for ZenML configuration and operations.

The file is organized into sections for each wrapper class:
1. GlobalConfigWrapper - Configuration management
2. ZenServerWrapper - Server management
3. PipelineRunsWrapper - Pipeline run operations
4. WorkspacesWrapper - Workspace management for ZenML Pro
5. ProjectsWrapper - Project management
6. StacksWrapper - Stack management
"""

import pathlib
from typing import Any, Dict, List, Optional, Tuple, Union

from type_hints import (
    ErrorResponse,
    GraphResponse,
    ListComponentsResponse,
    ListFlavorsResponse,
    ListPipelineRunsResponse,
    ListProjectsResponse,
    ListWorkspacesResponse,
    RunArtifactResponse,
    RunStepResponse,
    ZenmlGlobalConfigResp,
    ZenmlServerInfoResp,
)
from zenml_grapher import Grapher
from zenml_serializers import (
    serialize_flavor,
    serialize_response,
)


# =============================================================================
# 1. GlobalConfigWrapper
# =============================================================================
class GlobalConfigWrapper:
    """Wrapper class for global configuration management."""

    def __init__(self):
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        """Initializes the GlobalConfigWrapper instance."""
        self._gc = lazy_import("zenml.config.global_config", "GlobalConfiguration")()

    @property
    def gc(self):
        """Returns the global configuration instance."""
        return self._gc

    @property
    def fileio(self):
        """Provides access to file I/O operations."""
        return self.lazy_import("zenml.io", "fileio")

    @property
    def get_global_config_directory(self):
        """Returns the function to get the global configuration directory."""
        return self.lazy_import("zenml.utils.io_utils", "get_global_config_directory")

    @property
    def RestZenStoreConfiguration(self):
        """Returns the RestZenStoreConfiguration class for store configuration."""
        # pylint: disable=not-callable
        return self.lazy_import("zenml.zen_stores.rest_zen_store", "RestZenStoreConfiguration")

    def get_global_config_directory_path(self) -> str:
        """Get the global configuration directory path.

        Returns:
            str: Path to the global configuration directory.
        """
        # pylint: disable=not-callable
        config_dir = pathlib.Path(self.get_global_config_directory())
        if self.fileio.exists(str(config_dir)):
            return str(config_dir)
        return "Configuration directory does not exist."

    def get_global_config_file_path(self) -> str:
        """Get the global configuration file path.

        Returns:
            str: Path to the global configuration file.
        """
        # pylint: disable=not-callable
        config_dir = pathlib.Path(self.get_global_config_directory())
        config_path = config_dir / "config.yaml"
        if self.fileio.exists(str(config_path)):
            return str(config_path)
        return "Configuration file does not exist."

    def set_store_configuration(self, remote_url: str, access_token: str):
        """Set the store configuration.

        Args:
            remote_url (str): Remote URL.
            access_token (str): Access token.
        """
        # pylint: disable=not-callable
        new_store_config = self.RestZenStoreConfiguration(
            type="rest", url=remote_url, api_token=access_token, verify_ssl=True
        )

        # Method name changed in 0.55.4 - 0.56.1
        if hasattr(self.gc, "set_store_configuration"):
            self.gc.set_store_configuration(new_store_config)
        elif hasattr(self.gc, "set_store"):
            self.gc.set_store(new_store_config)
        else:
            raise AttributeError(
                "GlobalConfiguration object does not have a method to set store configuration."
            )
        self.gc.set_store(new_store_config)

    def get_global_configuration(self) -> ZenmlGlobalConfigResp:
        """Get the global configuration.

        Returns:
            dict: Global configuration.
        """

        store_attr_name = (
            "store_configuration" if hasattr(self.gc, "store_configuration") else "store"
        )

        store_data = getattr(self.gc, store_attr_name)

        return {
            "user_id": str(self.gc.user_id),
            "user_email": self.gc.user_email,
            "analytics_opt_in": self.gc.analytics_opt_in,
            "version": self.gc.version,
            "active_stack_id": str(self.gc.active_stack_id),
            "active_workspace_name": self.gc.active_workspace_name,
            "store": {
                "type": store_data.type,
                "url": store_data.url,
                "api_token": store_data.api_token if hasattr(store_data, "api_token") else None,
            },
        }


# =============================================================================
# 2. ZenServerWrapper
# =============================================================================
class ZenServerWrapper:
    """Wrapper class for Zen Server management."""

    def __init__(self, config_wrapper, projects_wrapper):
        """Initializes ZenServerWrapper with a configuration wrapper."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self._config_wrapper = config_wrapper
        self._projects_wrapper = projects_wrapper

    @property
    def gc(self):
        """Returns the global configuration via the config wrapper."""
        return self._config_wrapper.gc

    @property
    def web_login(self):
        """Provides access to the ZenML web login function."""
        return self.lazy_import("zenml.cli", "web_login")

    @property
    def ServerDeploymentNotFoundError(self):
        """Returns the ZenML ServerDeploymentNotFoundError class."""
        return self.lazy_import(
            "zenml.zen_server.deploy.exceptions",
            "ServerDeploymentNotFoundError",
        )

    @property
    def AuthorizationException(self):
        """Returns the ZenML AuthorizationException class."""
        return self.lazy_import("zenml.exceptions", "AuthorizationException")

    @property
    def StoreType(self):
        """Returns the ZenML StoreType enum."""
        return self.lazy_import("zenml.enums", "StoreType")

    @property
    def BaseZenStore(self):
        """Returns the BaseZenStore class for ZenML store operations."""
        return self.lazy_import("zenml.zen_stores.base_zen_store", "BaseZenStore")

    @property
    def ServerDeployer(self):
        """Provides access to the ZenML server deployment utilities."""
        return self.lazy_import("zenml.zen_server.deploy.deployer", "ServerDeployer")

    @property
    def ZenMLProClient(self):
        """Returns the ZenML Pro client class."""
        return self.lazy_import("zenml.login.pro.client", "ZenMLProClient")

    @property
    def get_active_deployment(self):
        """Returns the function to get the active ZenML server deployment."""
        return self.lazy_import("zenml.zen_server.utils", "get_active_deployment")

    def get_server_info(self) -> ZenmlServerInfoResp:
        """Fetches the ZenML server info.

        Returns:
            dict: Dictionary containing server info.
        """
        store_info = self.gc.zen_store.get_store_info()

        # Handle both 'store' and 'store_configuration' depending on version
        store_attr_name = (
            "store_configuration" if hasattr(self.gc, "store_configuration") else "store"
        )
        store_config = getattr(self.gc, store_attr_name)

        # ZenML Pro attributes
        organization_id = store_info.metadata.get("organization_id")
        organization_name = store_info.metadata.get("organization_name")
        active_workspace_id = store_info.metadata.get("workspace_id")
        active_workspace_name = store_info.metadata.get("workspace_name")

        active_project_id = None
        active_project_name = None
        active_project = self._projects_wrapper.get_active_project()
        # get_active_project uses @serialize_response, which returns a dict
        if active_project and not active_project.get("error"):
            if isinstance(active_project, dict):
                active_project_id = active_project.get("id")
                active_project_name = active_project.get("name")

        return {
            "storeInfo": {
                "id": str(store_info.id),
                "version": store_info.version,
                "debug": store_info.debug,
                "deployment_type": store_info.deployment_type,
                "database_type": store_info.database_type,
                "secrets_store_type": store_info.secrets_store_type,
                "auth_scheme": store_info.auth_scheme,
                "server_url": store_info.server_url,
                "dashboard_url": store_info.dashboard_url,
                # Add workspace, project and organization info for ZenML 0.80.0+ support
                "active_workspace_id": str(active_workspace_id) if active_workspace_id else None,
                "active_workspace_name": active_workspace_name,
                "active_project_id": str(active_project_id) if active_project_id else None,
                "active_project_name": active_project_name,
                "organization_id": str(organization_id) if organization_id else None,
                "organization_name": organization_name,
            },
            "storeConfig": {
                "type": store_config.type,
                "url": store_config.url,
                "api_token": store_config.api_token if hasattr(store_config, "api_token") else None,
            },
        }

    def connect(self, args, **kwargs) -> dict:
        """Connects to a ZenML server.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        url = args[0]
        verify_ssl = args[1] if len(args) > 1 else True

        if not url:
            return {"error": "Server URL is required."}

        try:
            # pylint: disable=not-callable
            access_token = self.web_login(url=url, verify_ssl=verify_ssl)
            self._config_wrapper.set_store_configuration(remote_url=url, access_token=access_token)
            return {"message": "Connected successfully.", "access_token": access_token}
        except self.AuthorizationException as e:
            return {"error": f"Authorization failed: {str(e)}"}

    def disconnect(self, args) -> dict:
        """Disconnects from a ZenML server.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            # Adjust for changes from 'store' to 'store_configuration'
            store_attr_name = (
                "store_configuration" if hasattr(self.gc, "store_configuration") else "store"
            )
            url = getattr(self.gc, store_attr_name).url
            store_type = self.BaseZenStore.get_store_type(url)

            # pylint: disable=not-callable
            server = self.get_active_deployment(local=True)
            deployer = self.ServerDeployer()

            messages = []

            if server:
                deployer.remove_server(server.config.name)
                messages.append("Shut down the local ZenML server.")
            else:
                messages.append("No local ZenML server was found running.")

            if store_type == self.StoreType.REST:
                deployer.disconnect_from_server()
                messages.append("Disconnected from the remote ZenML REST server.")

            self.gc.set_default_store()

            return {"message": " ".join(messages)}
        except self.ServerDeploymentNotFoundError as e:
            return {"error": f"Failed to disconnect: {str(e)}"}


# =============================================================================
# 3. PipelineRunsWrapper
# =============================================================================
class PipelineRunsWrapper:
    """Wrapper for interacting with ZenML pipeline runs."""

    def __init__(self, client):
        """Initializes PipelineRunsWrapper with a ZenML client."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self.client = client

    @property
    def ValidationError(self):
        """Returns the ZenML ZenMLBaseException class."""
        return self.lazy_import("zenml.exceptions", "ValidationError")

    @property
    def ZenMLBaseException(self):
        """Returns the ZenML ZenMLBaseException class."""
        return self.lazy_import("zenml.exceptions", "ZenMLBaseException")

    def _extract_steps_data(self, steps):
        """Extracts step data from a pipeline run."""
        steps_data = {}
        for step_name, step_info in steps.items():
            step_data = {}

            if hasattr(step_info, "status"):
                status = step_info.status
                step_data["status"] = status._value_ if hasattr(status, "_value_") else str(status)

            if hasattr(step_info, "start_time"):
                step_data["start_time"] = (
                    step_info.start_time.isoformat() if step_info.start_time else None
                )

            if hasattr(step_info, "end_time"):
                step_data["end_time"] = (
                    step_info.end_time.isoformat() if step_info.end_time else None
                )

            if hasattr(step_info, "id"):
                step_data["id"] = str(step_info.id)

            steps_data[step_name] = step_data

        return steps_data

    @serialize_response
    def fetch_pipeline_runs(self, args) -> Union[ListPipelineRunsResponse, ErrorResponse]:
        """Fetches ZenML pipeline runs with optional project filtering.

        Args:
            args (list): List containing:
                - page (int): The page number to fetch
                - max_size (int): Maximum items per page
                - project_name (str, optional): Filter runs by project name

        Returns:
            dict: Dictionary containing pipeline run data or error information.
        """
        if len(args) < 2:
            return {"error": "Not enough arguments provided. Required: page, max_size"}

        page = args[0]
        max_size = args[1]

        project_name = args[2] if len(args) > 2 else None

        try:
            query_params = {
                "sort_by": "desc:updated",
                "page": page,
                "size": max_size,
                "hydrate": True,
            }

            if project_name:
                query_params["project"] = project_name

            runs_page = self.client.list_pipeline_runs(**query_params)

            runs_data = []
            for run in runs_page.items:
                run_data = {
                    "id": str(run.id),
                    "name": run.name,
                    "status": str(run.status),
                    "stackName": run.stack.name,
                    "pipelineName": run.pipeline.name,
                    "startTime": (run.start_time.isoformat() if run.start_time else None),
                    "endTime": (run.end_time.isoformat() if run.end_time else None),
                }

                if hasattr(run, "config") and run.config:
                    run_data["config"] = {
                        "enable_cache": run.config.enable_cache,
                        "enable_artifact_metadata": run.config.enable_artifact_metadata,
                        "enable_artifact_visualization": run.config.enable_artifact_visualization,
                        "enable_step_logs": run.config.enable_step_logs,
                    }

                    if hasattr(run.config, "model") and run.config.model:
                        run_data["config"]["model"] = {
                            "name": run.config.model.name,
                            "description": run.config.model.description,
                            "tags": run.config.model.tags,
                            "version": run.config.model.version,
                            "save_models_to_registry": run.config.model.save_models_to_registry,
                            "license": run.config.model.license,
                        }

                if hasattr(run, "steps") and run.steps:
                    run_data["steps"] = self._extract_steps_data(run.steps)

                runs_data.append(run_data)

            return {
                "runs": runs_data,
                "total": runs_page.total,
                "total_pages": runs_page.total_pages,
                "current_page": page,
                "items_per_page": max_size,
                "project_name": project_name,
            }
        except self.ValidationError as e:
            return {"error": "ValidationError", "message": str(e)}
        except self.ZenMLBaseException as e:
            return [{"error": f"Failed to retrieve pipeline runs: {str(e)}"}]

    def delete_pipeline_run(self, args) -> dict:
        """Deletes a ZenML pipeline run.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            run_id = args[0]
            self.client.delete_pipeline_run(run_id)
            return {"message": f"Pipeline run `{run_id}` deleted successfully."}
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to delete pipeline run: {str(e)}"}

    def get_pipeline_run(self, args: Tuple[str]) -> dict:
        """Gets a ZenML pipeline run.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            run_id = args[0]
            run = self.client.get_pipeline_run(run_id, hydrate=True)
            run_data = {
                "id": str(run.id),
                "name": run.pipeline.name,
                "status": run.status,
                "stackName": run.stack.name,
                "startTime": (
                    run.metadata.start_time.isoformat() if run.metadata.start_time else None
                ),
                "endTime": (run.metadata.end_time.isoformat() if run.metadata.end_time else None),
                "os": run.metadata.client_environment.get("os", "Unknown OS"),
                "osVersion": run.metadata.client_environment.get(
                    "os_version",
                    run.metadata.client_environment.get("mac_version", "Unknown Version"),
                ),
                "pythonVersion": run.metadata.client_environment.get("python_version", "Unknown"),
            }

            if hasattr(run, "steps") and run.steps:
                run_data["steps"] = self._extract_steps_data(run.steps)

            return run_data
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run: {str(e)}"}

    @serialize_response
    def get_pipeline_run_graph(self, args: Tuple[str]) -> Union[GraphResponse, ErrorResponse]:
        """Gets a ZenML pipeline run step DAG.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            run_id = args[0]
            run = self.client.get_pipeline_run(run_id)
            graph = Grapher(run)
            graph.build_nodes_from_steps()
            graph.build_edges_from_steps()
            return graph.to_dict()
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run graph: {str(e)}"}

    @serialize_response
    def get_run_step(self, args: Tuple[str]) -> Union[RunStepResponse, ErrorResponse]:
        """Gets a ZenML pipeline run step.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            step_run_id = args[0]
            step = self.client.get_run_step(step_run_id, hydrate=True)
            run = self.client.get_pipeline_run(step.metadata.pipeline_run_id, hydrate=True)

            step_data = {
                "name": step.name,
                "id": str(step.id),
                "status": step.status,
                "author": {
                    "fullName": step.user.full_name,
                    "email": step.user.name,
                },
                "startTime": (step.start_time.isoformat() if step.start_time else None),
                "endTime": (step.end_time.isoformat() if step.end_time else None),
                "duration": (
                    str(step.end_time - step.start_time)
                    if step.end_time and step.start_time
                    else None
                ),
                "stackName": run.stack.name,
                "orchestrator": {"runId": str(run.metadata.orchestrator_run_id)},
                "pipeline": {
                    "name": run.pipeline.name,
                    "status": run.status,
                },
                "cacheKey": step.metadata.cache_key,
                "sourceCode": step.metadata.source_code,
                "logsUri": step.metadata.logs.uri,
            }
            return step_data
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run step: {str(e)}"}

    def get_run_artifact(self, args: Tuple[str]) -> Union[RunArtifactResponse, ErrorResponse]:
        """Gets a ZenML pipeline run artifact.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            artifact_id = args[0]
            artifact = self.client.get_artifact_version(artifact_id, hydrate=True)

            metadata = {}
            for key in artifact.metadata.run_metadata:
                metadata[key] = artifact.metadata.run_metadata[key].body.value

            artifact_data = {
                "name": artifact.body.artifact.name,
                "version": artifact.body.version,
                "id": str(artifact.id),
                "type": artifact.body.type,
                "author": {
                    "fullName": artifact.body.user.body.full_name,
                    "email": artifact.body.user.name,
                },
                "updated": artifact.body.updated.isoformat(),
                "data": {
                    "uri": artifact.body.uri,
                    "dataType": artifact.body.data_type.attribute,
                },
                "metadata": metadata,
            }
            return artifact_data

        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run artifact: {str(e)}"}


# =============================================================================
# 4. WorkspacesWrapper
# =============================================================================
class WorkspacesWrapper:
    """Wrapper class for Workspace management."""

    def __init__(self, client, config_wrapper):
        """Initializes WorkspacesWrapper with a ZenML client."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self.client = client
        self._config_wrapper = config_wrapper

    @property
    def gc(self):
        """Returns the ZenML global configuration."""
        return self._config_wrapper.gc

    @property
    def ZenMLBaseException(self):
        """Returns the ZenML ZenMLBaseException class."""
        return self.lazy_import("zenml.exceptions", "ZenMLBaseException")

    @property
    def ZenMLProClient(self):
        """Returns the ZenMLProClient class."""
        return self.lazy_import("zenml.login.pro.client", "ZenMLProClient")

    @serialize_response
    def list_workspaces(self, args) -> Union[ListWorkspacesResponse, ErrorResponse]:
        """Lists workspaces from ZenML Pro.

        Args:
            args: A tuple containing (offset, limit)

        Returns:
            A dictionary containing workspaces or an error message.
        """
        try:
            store_info = self.gc.zen_store.get_store_info()
            pro_api_url = store_info.get("pro_api_url")

            # Initialize Pro client for workspace access
            pro_client = self.ZenMLProClient(url=pro_api_url)

            offset = args[0] if len(args) > 0 else 0
            limit = args[1] if len(args) > 1 else 10

            workspaces = pro_client.workspace.list(offset=offset, limit=limit)

            workspaces_data = [
                {
                    "id": str(workspace.id),
                    "name": workspace.name,
                    "description": workspace.description,
                    "display_name": workspace.display_name,
                    "organization_id": str(workspace.organization.id),
                    "organization_name": workspace.organization.name,
                    "status": workspace.status,
                    "zenml_version": workspace.version,
                    "zenml_server_url": workspace.url,
                    "dashboard_url": workspace.dashboard_url,
                    "dashboard_organization_url": workspace.dashboard_organization_url,
                }
                for workspace in workspaces
            ]

            return {
                "workspaces": workspaces_data,
                "total": len(workspaces_data),
                "offset": offset,
                "limit": limit,
            }
        except Exception as e:
            return {"error": f"Failed to list workspaces: {str(e)}"}

    @serialize_response
    def get_active_workspace(self) -> Union[Dict[str, str], ErrorResponse]:
        """Gets the active workspace for the current user.

        Returns:
            A dictionary containing the active workspace information or an error message.
        """
        try:
            # Initialize Pro client for workspace access
            store_info = self.gc.zen_store.get_store_info()
            pro_api_url = store_info.get("pro_api_url")

            pro_client = self.ZenMLProClient(url=pro_api_url)

            # Get the first workspace as the active one
            workspaces = pro_client.workspace.list(limit=1)
            if not workspaces or len(workspaces) == 0:
                return {"error": "No workspaces found"}

            workspace = workspaces[0]
            return {
                "id": str(workspace.id),
                "name": workspace.name,
                "organization_id": str(workspace.organization_id),
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to get active workspace: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error getting active workspace: {str(e)}"}


# =============================================================================
# 5. ProjectsWrapper
# =============================================================================
class ProjectsWrapper:
    """Wrapper class for Project management."""

    def __init__(self, client):
        """Initializes ProjectsWrapper with a ZenML client."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self.client = client

    @property
    def ZenMLBaseException(self):
        """Returns the ZenML ZenMLBaseException class."""
        return self.lazy_import("zenml.exceptions", "ZenMLBaseException")

    @serialize_response
    def list_projects(self, args) -> Union[ListProjectsResponse, ErrorResponse]:
        """Lists projects from ZenML.

        Args:
            args: A tuple containing (page, size)

        Returns:
            A dictionary containing projects or an error message.
        """
        try:
            page = args[0] if len(args) > 0 else 0
            size = args[1] if len(args) > 1 else 10

            projects = self.client.list_projects(page=page, size=size)

            projects_data = [
                {
                    "id": str(project.id),
                    "name": project.name,
                    "display_name": project.display_name,
                    "created": project.created.isoformat(),
                    "updated": project.updated.isoformat(),
                    "metadata": project.metadata,
                }
                for project in projects.items
            ]

            return {
                "projects": projects_data,
                "total": projects.total,
                "total_pages": projects.total_pages,
                "current_page": page,
                "items_per_page": size,
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to list projects: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error listing projects: {str(e)}"}

    @serialize_response
    def get_active_project(self) -> Union[Dict[str, str], ErrorResponse]:
        """Gets the active project for the current user.

        Returns:
            A dictionary containing the active project information or an error message.
        """
        try:
            active_project = self.client.active_project

            return {
                "id": str(active_project.id),
                "name": active_project.name,
                "display_name": active_project.display_name,
                "created": active_project.created.isoformat(),
                "updated": active_project.updated.isoformat(),
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to get active project: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error getting active project: {str(e)}"}

    @serialize_response
    def set_active_project(self, args) -> Union[Dict[str, Any], ErrorResponse]:
        """Sets the active project for the current user.

        Args:
            args: A tuple containing the project ID to set as active

        Returns:
            A dictionary containing the active project information or an error message.
        """
        try:
            if not args or len(args) < 1:
                return {"error": "Project ID is required"}

            project_id = args[0]

            self.client.set_active_project(project_id)

            active_project = self.client.active_project

            return {
                "id": str(active_project.id),
                "name": active_project.name,
                "display_name": active_project.display_name,
                "created": active_project.created.isoformat(),
                "updated": active_project.updated.isoformat(),
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to set active project: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error setting active project: {str(e)}"}

    @serialize_response
    def get_project_by_name(self, project_name: str) -> Union[Dict[str, str], ErrorResponse]:
        """Gets a project by name.

        Args:
            project_name: The name of the project to get

        Returns:
            A dictionary containing the project information or an error message.
        """
        try:
            project = self.client.get_project(project_name)

            return {
                "id": str(project.id),
                "name": project.name,
                "display_name": project.display_name,
                "created": project.created.isoformat(),
                "updated": project.updated.isoformat(),
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to get project by name: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error getting project by name: {str(e)}"}


# =============================================================================
# 6. StacksWrapper
# =============================================================================
class StacksWrapper:
    """Wrapper class for Stacks management."""

    def __init__(self, client):
        """Initializes StacksWrapper with a ZenML client."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self.client = client
        self.active_stack_id = None

    @property
    def ZenMLBaseException(self):
        """Returns the ZenML ZenMLBaseException class."""
        return self.lazy_import("zenml.exceptions", "ZenMLBaseException")

    @property
    def ValidationError(self):
        """Returns the ZenML ZenMLBaseException class."""
        return self.lazy_import("zenml.exceptions", "ValidationError")

    @property
    def IllegalOperationError(self) -> Any:
        """Returns the IllegalOperationError class."""
        return self.lazy_import("zenml.exceptions", "IllegalOperationError")

    @property
    def StackComponentValidationError(self):
        """Returns the ZenML StackComponentValidationError class."""
        return self.lazy_import("zenml.exceptions", "StackComponentValidationError")

    @property
    def StackComponentType(self):
        """Returns the ZenML StackComponentType enum."""
        return self.lazy_import("zenml.enums", "StackComponentType")

    @property
    def ZenKeyError(self) -> Any:
        """Returns the ZenKeyError class."""
        return self.lazy_import("zenml.exceptions", "ZenKeyError")

    @serialize_response
    def get_active_stack(self) -> dict:
        """Fetches the active ZenML stack.

        Returns:
            dict: Dictionary containing active stack data.
        """
        try:
            active_stack = self.client.active_stack_model
            if active_stack:
                stack_data = self._process_stack(active_stack)
                return stack_data
            return {"message": "No active stack found"}
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve active stack: {str(e)}"}

    @serialize_response
    def get_stack_by_id(self, args) -> dict:
        """Gets a stack by name or id.

        Args:
            args: A tuple containing the stack name or id.
        """
        stack_id = args[0]
        try:
            stack = self.client.get_stack(stack_id)
            return self._process_stack(stack)
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to get stack by id: {str(e)}"}

    @serialize_response
    def fetch_stacks(self, args):
        """Fetches all ZenML stacks and components with pagination."""
        if len(args) < 2:
            return {"error": "Insufficient arguments provided."}

        page = args[0]
        max_size = args[1]
        active_stack_id = args[2]

        try:
            stacks_page = self.client.list_stacks(page=page, size=max_size, hydrate=True)
            stacks_data = self.process_stacks(stacks_page.items)
            active_stack_data = None
            active_stack = None

            if active_stack_id is not None:
                self.active_stack_id = active_stack_id
                active_stack_data = self.get_stack_by_id([active_stack_id])
                active_stack = active_stack_data
            else:
                active_stack = self.get_active_stack()
                if active_stack:
                    self.active_stack_id = active_stack["id"]
                    active_stack_data = active_stack

            if active_stack:
                stacks_data = [stack for stack in stacks_data if stack["id"] != active_stack["id"]]

            return {
                "active_stack": active_stack_data,
                "stacks": stacks_data,
                "total": stacks_page.total,
                "total_pages": stacks_page.total_pages,
                "current_page": page,
                "items_per_page": max_size,
            }
        except self.ValidationError as e:
            return {"error": "ValidationError", "message": str(e)}
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve stacks: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error: {str(e)}"}

    def _process_component(self, component):
        """Process a component to the desired format."""
        try:
            return {
                "id": str(component.id),
                "name": component.name,
                "type": str(component.type),
                "flavor_name": component.flavor_name,  # Direct access without body
                "integration": getattr(component, "integration", None),
                "logo_url": getattr(component, "logo_url", None),
            }
        except Exception as e:
            return {
                "id": str(getattr(component, "id", "unknown")),
                "name": getattr(component, "name", "Error processing component"),
                "error": str(e),
            }

    def _process_stack(self, stack):
        """Process a stack to the desired format."""
        try:
            # Get basic stack information
            stack_data = {
                "id": str(stack.id),
                "name": stack.name,
                "created": getattr(stack, "created", None),
                "updated": getattr(stack, "updated", None),
                "user_id": str(stack.user.id) if hasattr(stack, "user") and stack.user else None,
                "description": getattr(stack, "description", None),
                "components": {},
            }

            # Process components
            for comp_type, components in stack.components.items():
                comp_type_str = str(comp_type)
                stack_data["components"][comp_type_str] = [
                    self._process_component(component) for component in components
                ]

            return stack_data
        except Exception as e:
            return {
                "id": str(getattr(stack, "id", "unknown")),
                "name": getattr(stack, "name", "Error processing stack"),
                "error": f"Error processing stack: {str(e)}",
            }

    def process_stacks(self, stacks):
        """Process stacks to the desired format."""
        try:
            result = [self._process_stack(stack) for stack in stacks]

            if not result:
                return [{"message": "No stacks found or all stacks failed to process"}]

            return result
        except Exception as e:
            return [{"error": f"Error processing stacks: {str(e)}"}]

    @serialize_response
    def set_active_stack(self, args) -> dict:
        """Sets the active ZenML stack.

        Args:
            args (list): List containing the stack name or id.
        Returns:
            dict: Dictionary containing the active stack data.
        """
        stack_name_or_id = args[0]

        if not stack_name_or_id:
            return {"error": "Missing stack_name_or_id"}

        try:
            self.client.activate_stack(stack_name_id_or_prefix=stack_name_or_id)
            active_stack = self.client.active_stack_model
            return {
                "message": f"Active stack set to: {active_stack.name}",
                "id": str(active_stack.id),
                "name": active_stack.name,
            }
        except KeyError as err:
            return {"error": str(err)}

    @serialize_response
    def rename_stack(self, args) -> dict:
        """Renames a specified ZenML stack.

        Args:
            args (list): List containing the stack name or id and the new stack name.
        Returns:
            dict: Dictionary containing the renamed stack data.
        """
        stack_name_or_id = args[0]
        new_stack_name = args[1]

        if not stack_name_or_id or not new_stack_name:
            return {"error": "Missing stack_name_or_id or new_stack_name"}

        try:
            self.client.update_stack(
                name_id_or_prefix=stack_name_or_id,
                name=new_stack_name,
            )
            return {
                "message": f"Stack `{stack_name_or_id}` successfully renamed to `{new_stack_name}`!"
            }
        except (KeyError, self.IllegalOperationError) as err:
            return {"error": str(err)}

    @serialize_response
    def copy_stack(self, args) -> dict:
        """Copies a specified ZenML stack to a new stack.

        Args:
            args (list): List containing the source stack name or id and the target stack name.
        Returns:
            dict: Dictionary containing the copied stack data.
        """
        source_stack_name_or_id = args[0]
        target_stack_name = args[1]

        if not source_stack_name_or_id or not target_stack_name:
            return {"error": "Both source stack name/id and target stack name are required"}

        try:
            stack_to_copy = self.client.get_stack(name_id_or_prefix=source_stack_name_or_id)
            component_mapping = {
                c_type: [c.id for c in components][0]
                for c_type, components in stack_to_copy.components.items()
                if components
            }

            self.client.create_stack(name=target_stack_name, components=component_mapping)
            return {
                "message": (
                    f"Stack `{source_stack_name_or_id}` successfully copied "
                    f"to `{target_stack_name}`!"
                )
            }
        except (
            self.ZenKeyError,
            self.StackComponentValidationError,
        ) as e:
            return {"error": str(e)}

    @serialize_response
    def register_stack(self, args: Tuple[str, Dict[str, str]]) -> Dict[str, str]:
        """Registers a new ZenML Stack.

        Args:
            args (list): List containing the name and chosen components for the stack.
        Returns:
            Dictionary containing a message relevant to whether the action succeeded or failed
        """
        [name, components] = args

        try:
            self.client.create_stack(name, components)
            return {"message": f"Stack {name} successfully registered"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}

    @serialize_response
    def update_stack(self, args: Tuple[str, str, Dict[str, List[str]]]) -> Dict[str, str]:
        """Updates a specified ZenML Stack.

        Args:
            args (list): List containing the id of the stack being updated, the new name,
                         and the chosen components.
        Returns:
            Dictionary containing a message relevant to whether the action succeeded or failed
        """
        [id, name, components] = args

        try:
            old = self.client.get_stack(id)
            if old.name == name:
                self.client.update_stack(name_id_or_prefix=id, component_updates=components)
            else:
                self.client.update_stack(
                    name_id_or_prefix=id,
                    name=name,
                    component_updates=components,
                )

            return {"message": f"Stack {name} successfully updated."}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}

    @serialize_response
    def delete_stack(self, args: Tuple[str]) -> Dict[str, str]:
        """Deletes a specified ZenML stack.

        Args:
            args (list): List containing the id of the stack to delete.
        Returns:
            Dictionary containing a message relevant to whether the action succeeded or failed
        """
        [id] = args

        try:
            self.client.delete_stack(id)

            return {"message": f"Stack {id} successfully deleted."}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}

    @serialize_response
    def register_component(self, args: Tuple[str, str, str, Dict[str, str]]) -> Dict[str, str]:
        """Registers a new ZenML stack component.

        Args:
            args (list): List containing the component type, flavor used, name,
                         and configuration of the desired new component.
        Returns:
            Dictionary containing a message relevant to whether the action succeeded or failed
        """
        [component_type, flavor, name, configuration] = args

        try:
            self.client.create_stack_component(name, flavor, component_type, configuration)

            return {"message": f"Stack Component {name} successfully registered"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}

    @serialize_response
    def update_component(self, args: Tuple[str, str, str, Dict[str, str]]) -> Dict[str, str]:
        """Updates a specified ZenML stack component.

        Args:
            args (list): List containing the id, component type, new name, and desired
                         configuration of the desired component.
        Returns:
            Dictionary containing a message relevant to whether the action succeeded or failed
        """
        [id, component_type, name, configuration] = args

        try:
            old = self.client.get_stack_component(component_type, id)

            new_name = None if old.name == name else name

            self.client.update_stack_component(
                id, component_type, name=new_name, configuration=configuration
            )

            return {"message": f"Stack Component {name} successfully updated"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}

    @serialize_response
    def delete_component(self, args: Tuple[str, str]) -> Dict[str, str]:
        """Deletes a specified ZenML stack component.

        Args:
            args (list): List containing the id and component type of the desired component.
        Returns:
            Dictionary containing a message relevant to whether the action succeeded or failed
        """
        [id, component_type] = args

        try:
            self.client.delete_stack_component(id, component_type)

            return {"message": f"Stack Component {id} successfully deleted"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}

    @serialize_response
    def list_components(
        self, args: Tuple[int, int, Union[str, None]]
    ) -> Union[ListComponentsResponse, ErrorResponse]:
        """Lists stack components in a paginated way.

        Args:
            args (list): List containing the page, maximum items per page, and an optional
                         type filter used to retrieve expected components.
        Returns:
            A Dictionary containing the paginated results or an error message
            specifying why the action failed.
        """
        if len(args) < 2:
            return {"error": "Insufficient arguments provided."}

        page = args[0]
        max_size = args[1]
        filter = None

        if len(args) >= 3:
            filter = args[2]

        try:
            components = self.client.list_stack_components(
                page=page, size=max_size, type=filter, hydrate=True
            )

            return {
                "index": components.index,
                "max_size": components.max_size,
                "total_pages": components.total_pages,
                "total": components.total,
                "items": [
                    {
                        "id": str(item.id),
                        "name": item.name,
                        "flavor": serialize_flavor(item.flavor),
                        "type": str(item.type),
                        "config": item.metadata.configuration,
                    }
                    for item in components.items
                ],
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve list of stack components: {str(e)}"}

    @serialize_response
    def get_component_types(self) -> Union[List[str], ErrorResponse]:
        """Gets a list of all component types.

        Returns:
            A list of component types or a dictionary containing an error message
            specifying why the action failed.
        """
        try:
            return self.StackComponentType.values()
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve list of component types: {str(e)}"}

    @serialize_response
    def list_flavors(
        self, args: Tuple[int, int, Optional[str]]
    ) -> Union[ListFlavorsResponse, ErrorResponse]:
        """Lists stack component flavors in a paginated way.

        Args:
            args (list): List containing page, max items per page, and an optional component type
            filter used to retrieve expected component flavors.
        Returns:
            A Dictionary containing the paginated results or an error message specifying why the
            action failed.
        """
        if len(args) < 2:
            return {"error": "Insufficient arguments provided."}

        page = args[0]
        max_size = args[1]
        filter = None
        if len(args) >= 3:
            filter = args[2]

        try:
            flavors = self.client.list_flavors(page=page, size=max_size, type=filter, hydrate=True)

            return {
                "index": flavors.index,
                "max_size": flavors.max_size,
                "total_pages": flavors.total_pages,
                "total": flavors.total,
                "items": [
                    {
                        "id": str(flavor.id),
                        "name": flavor.name,
                        "type": flavor.type,
                        "logo_url": flavor.logo_url,
                        "config_schema": flavor.metadata.config_schema,
                        "docs_url": flavor.metadata.docs_url,
                        "sdk_docs_url": flavor.metadata.sdk_docs_url,
                        "connector_type": flavor.metadata.connector_type,
                        "connector_resource_type": flavor.metadata.connector_resource_type,
                        "connector_resource_id_attr": flavor.metadata.connector_resource_id_attr,
                    }
                    for flavor in flavors.items
                ],
            }

        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve list of flavors: {str(e)}"}
