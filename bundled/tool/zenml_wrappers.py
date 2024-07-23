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
"""This module provides wrappers for ZenML configuration and operations."""

import pathlib
from typing import Any, Tuple, Union, List, Optional, Dict
from zenml_grapher import Grapher
from type_hints import (
    GraphResponse, 
    ErrorResponse, 
    RunStepResponse, 
    RunArtifactResponse, 
    ZenmlServerInfoResp, 
    ZenmlGlobalConfigResp,
    ListComponentsResponse,
    ListFlavorsResponse
)


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
        return self.lazy_import(
            "zenml.zen_stores.rest_zen_store", "RestZenStoreConfiguration"
        )

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
                "api_token": store_data.api_token if hasattr(store_data, "api_token") else None
            }
        }


class ZenServerWrapper:
    """Wrapper class for Zen Server management."""

    def __init__(self, config_wrapper):
        """Initializes ZenServerWrapper with a configuration wrapper."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self._config_wrapper = config_wrapper

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
            "zenml.zen_server.deploy.exceptions", "ServerDeploymentNotFoundError"
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
            "store_configuration"
            if hasattr(self.gc, "store_configuration")
            else "store"
        )
        store_config = getattr(self.gc, store_attr_name)
        
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
            }, 
            "storeConfig": {
                "type": store_config.type,
                "url": store_config.url,
                "api_token": store_config.api_token if hasattr(store_config, "api_token") else None
            }
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
            self._config_wrapper.set_store_configuration(
                remote_url=url, access_token=access_token
            )
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
                "store_configuration"
                if hasattr(self.gc, "store_configuration")
                else "store"
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

    def fetch_pipeline_runs(self, args):
        """Fetches all ZenML pipeline runs.

        Returns:
            list: List of dictionaries containing pipeline run data.
        """
        page = args[0]
        max_size = args[1]
        try:
            runs_page = self.client.list_pipeline_runs(
                sort_by="desc:updated", page=page, size=max_size, hydrate=True
            )
            runs_data = [
                {
                    "id": str(run.id),
                    "name": run.body.pipeline.name,
                    "status": run.body.status,
                    "version": run.body.pipeline.body.version,
                    "stackName": run.body.stack.name,
                    "startTime": (
                        run.metadata.start_time.isoformat()
                        if run.metadata.start_time
                        else None
                    ),
                    "endTime": (
                        run.metadata.end_time.isoformat()
                        if run.metadata.end_time
                        else None
                    ),
                    "os": run.metadata.client_environment.get("os", "Unknown OS"),
                    "osVersion": run.metadata.client_environment.get(
                        "os_version",
                        run.metadata.client_environment.get(
                            "mac_version", "Unknown Version"
                        ),
                    ),
                    "pythonVersion": run.metadata.client_environment.get(
                        "python_version", "Unknown"
                    ),
                }
                for run in runs_page.items
            ]

            return {
                "runs": runs_data,
                "total": runs_page.total,
                "total_pages": runs_page.total_pages,
                "current_page": page,
                "items_per_page": max_size,
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
                "name": run.body.pipeline.name,
                "status": run.body.status,
                "version": run.body.pipeline.body.version,
                "stackName": run.body.stack.name,
                "startTime": (
                    run.metadata.start_time.isoformat()
                    if run.metadata.start_time
                    else None
                ),
                "endTime": (
                    run.metadata.end_time.isoformat() if run.metadata.end_time else None
                ),
                "os": run.metadata.client_environment.get("os", "Unknown OS"),
                "osVersion": run.metadata.client_environment.get(
                    "os_version",
                    run.metadata.client_environment.get(
                        "mac_version", "Unknown Version"
                    ),
                ),
                "pythonVersion": run.metadata.client_environment.get(
                    "python_version", "Unknown"
                ),
            }

            return run_data
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run: {str(e)}"}

    def get_pipeline_run_graph(
        self, args: Tuple[str]
    ) -> Union[GraphResponse, ErrorResponse]:
        """Gets a ZenML pipeline run step DAG.

        Args:
            args (list): List of arguments.
        Returns:
            dict: Dictionary containing the result of the operation.
        """
        try:
            run_id = args[0]
            run = self.client.get_pipeline_run(run_id, hydrate=True)
            graph = Grapher(run)
            graph.build_nodes_from_steps()
            graph.build_edges_from_steps()
            return graph.to_dict()
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run graph: {str(e)}"}

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
            run = self.client.get_pipeline_run(
                step.metadata.pipeline_run_id, hydrate=True
            )

            step_data = {
                "name": step.name,
                "id": str(step.id),
                "status": step.body.status,
                "author": {
                    "fullName": step.body.user.body.full_name,
                    "email": step.body.user.name,
                },
                "startTime": (
                    step.metadata.start_time.isoformat()
                    if step.metadata.start_time
                    else None
                ),
                "endTime": (
                    step.metadata.end_time.isoformat()
                    if step.metadata.end_time
                    else None
                ),
                "duration": (
                    str(step.metadata.end_time - step.metadata.start_time)
                    if step.metadata.end_time and step.metadata.start_time
                    else None
                ),
                "stackName": run.body.stack.name,
                "orchestrator": {"runId": str(run.metadata.orchestrator_run_id)},
                "pipeline": {
                    "name": run.body.pipeline.name,
                    "status": run.body.status,
                    "version": run.body.pipeline.body.version,
                },
                "cacheKey": step.metadata.cache_key,
                "sourceCode": step.metadata.source_code,
                "logsUri": step.metadata.logs.body.uri,
            }
            return step_data
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve pipeline run step: {str(e)}"}

    def get_run_artifact(
        self, args: Tuple[str]
    ) -> Union[RunArtifactResponse, ErrorResponse]:
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


class StacksWrapper:
    """Wrapper class for Stacks management."""

    def __init__(self, client):
        """Initializes StacksWrapper with a ZenML client."""
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import

        self.lazy_import = lazy_import
        self.client = client

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

    def fetch_stacks(self, args):
        """Fetches all ZenML stacks and components with pagination."""
        if len(args) < 2:
            return {"error": "Insufficient arguments provided."}
        page, max_size = args
        try:
            stacks_page = self.client.list_stacks(
                page=page, size=max_size, hydrate=True
            )
            stacks_data = self.process_stacks(stacks_page.items)

            return {
                "stacks": stacks_data,
                "total": stacks_page.total,
                "total_pages": stacks_page.total_pages,
                "current_page": page,
                "items_per_page": max_size,
            }
        except self.ValidationError as e:
            return {"error": "ValidationError", "message": str(e)}
        except self.ZenMLBaseException as e:
            return [{"error": f"Failed to retrieve stacks: {str(e)}"}]

    def process_stacks(self, stacks):
        """Process stacks to the desired format."""
        return [
            {
                "id": str(stack.id),
                "name": stack.name,
                "components": {
                    component_type: [
                        {
                            "id": str(component.id),
                            "name": component.name,
                            "flavor": component.flavor,
                            "type": component.type,
                        }
                        for component in components
                    ]
                    for component_type, components in stack.components.items()
                },
            }
            for stack in stacks
        ]

    def get_active_stack(self) -> dict:
        """Fetches the active ZenML stack.

        Returns:
            dict: Dictionary containing active stack data.
        """
        try:
            active_stack = self.client.active_stack_model
            return {
                "id": str(active_stack.id),
                "name": active_stack.name,
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve active stack: {str(e)}"}

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
            return {
                "error": "Both source stack name/id and target stack name are required"
            }

        try:
            stack_to_copy = self.client.get_stack(
                name_id_or_prefix=source_stack_name_or_id
            )
            component_mapping = {
                c_type: [c.id for c in components][0]
                for c_type, components in stack_to_copy.components.items()
                if components
            }

            self.client.create_stack(
                name=target_stack_name, components=component_mapping
            )
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
    
    def create_stack(self, args: Tuple[str, Dict[str, str]]) -> Dict[str, str]:
        [name, components] = args

        try:
            self.client.create_stack(name, components)
            return {"message": f"Stack {name} successfully created"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        
    def update_stack(self, args: Tuple[str, str, Dict[str, List[str]]]) -> Dict[str, str]:
        [id, name, components] = args

        try:
            old = self.client.get_stack(id)
            if old.name == name:
                self.client.update_stack(name_id_or_prefix=id, component_updates=components)
            else:
                self.client.update_stack(name_id_or_prefix=id, name=name, component_updates=components)
                
            return {"message": f"Stack {name} successfully updated."}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        
    def delete_stack(self, args: Tuple[str]) -> Dict[str, str]:
        [id] = args

        try:
            self.client.delete_stack(id)

            return {"message": f"Stack {id} successfully deleted."}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        
    def create_component(self, args: Tuple[str, str, str, Dict[str, str]]) -> Dict[str, str]:
        [component_type, flavor, name, configuration] = args
        
        try:
            self.client.create_stack_component(name, flavor, component_type, configuration)

            return {"message": f"Stack Component {name} successfully created"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        
    def update_component(self, args: Tuple[str, str, str, Dict[str, str]]) -> Dict[str, str]:
        [id, component_type, name, configuration] = args
        
        try:
            old = self.client.get_stack_component(component_type, id)

            if old.name == name:
                name = None

            self.client.update_stack_component(id, component_type, name=name, configuration=configuration)

            return {"message": f"Stack Component {name} successfully updated"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}
        
    def delete_component(self, args: Tuple[str, str]) -> Dict[str, str]:
        [id, component_type] = args

        try:
            self.client.delete_stack_component(id, component_type)

            return {"mesage": f"Stack Component {id} successfully deleted"}
        except self.ZenMLBaseException as e:
            return {"error": str(e)}
    
    def list_components(self, args: Tuple[int, int, Union[str, None]]) -> Union[ListComponentsResponse,ErrorResponse]:
        if len(args) < 2:
            return {"error": "Insufficient arguments provided."}
        
        page = args[0]
        max_size = args[1]
        filter = None

        if len(args) >= 3:
            filter = args[2]

        try:
            components = self.client.list_stack_components(page=page, size=max_size, type=filter, hydrate=True)

            return {
                "index": components.index,
                "max_size": components.max_size,
                "total_pages": components.total_pages,
                "total": components.total,
                "items": [
                    {
                        "id": str(item.id),
                        "name": item.name,
                        "flavor": item.body.flavor,
                        "type": item.body.type,
                        "config": item.metadata.configuration,
                    }
                    for item in components.items
                ],
            }
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve list of stack components: {str(e)}"}

    def get_component_types(self) -> Union[List[str], ErrorResponse]:
        try:
            return self.StackComponentType.values()
        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve list of component types: {str(e)}"}
    
    def list_flavors(self, args: Tuple[int, int, Optional[str]]) -> Union[ListFlavorsResponse, ErrorResponse]:
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
                        "type": flavor.body.type,
                        "logo_url": flavor.body.logo_url,
                        "config_schema": flavor.metadata.config_schema,
                        "docs_url": flavor.metadata.docs_url,
                        "sdk_docs_url": flavor.metadata.sdk_docs_url,
                        "connector_type": flavor.metadata.connector_type,
                        "connector_resource_type": flavor.metadata.connector_resource_type,
                        "connector_resource_id_attr": flavor.metadata.connector_resource_id_attr,
                    } for flavor in flavors.items
                ]
            }

        except self.ZenMLBaseException as e:
            return {"error": f"Failed to retrieve list of flavors: {str(e)}"}