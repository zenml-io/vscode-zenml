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
"""
Extends the main Language Server Protocol (LSP) server for ZenML
by adding custom functionalities. It acts as a wrapper around the core LSP
server implementation (`lsp_server.py`), providing ZenML-specific features
such as checking ZenML installation, verifying version compatibility, and
updating Python interpreter paths.
"""

import asyncio
import subprocess
import sys
from functools import wraps

import lsprotocol.types as lsp
from constants import IS_ZENML_INSTALLED, MIN_ZENML_VERSION, TOOL_MODULE_NAME
from lazy_import import suppress_stdout_temporarily
from packaging.version import parse as parse_version
from pygls.server import LanguageServer
from zen_watcher import ZenConfigWatcher
from zenml_client import ZenMLClient

zenml_init_error = {"error": "ZenML is not initialized. Please check ZenML version requirements."}


class ZenLanguageServer(LanguageServer):
    """ZenML Language Server implementation."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.python_interpreter = sys.executable
        self.zenml_client = None
        # self.register_commands()

    async def is_zenml_installed(self) -> bool:
        """Asynchronously checks if ZenML is installed."""
        try:
            process = await asyncio.create_subprocess_exec(
                self.python_interpreter,
                "-c",
                "import zenml; print(zenml.__version__)",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await process.wait()
            if process.returncode == 0:
                self.show_message_log("✅ ZenML installation check: Successful.")
                return True
            self.show_message_log("❌ ZenML installation check failed.", lsp.MessageType.Error)
            return False
        except Exception as e:
            self.show_message_log(
                f"Error checking ZenML installation: {str(e)}", lsp.MessageType.Error
            )
            return False

    async def initialize_zenml_client(self):
        """Initializes the ZenML client."""
        self.send_custom_notification("zenml/client", {"status": "pending"})
        if self.zenml_client is not None:
            # Client is already initialized.
            self.notify_user("⭐️ ZenML Client Already Initialized ⭐️")
            return

        if not await self.is_zenml_installed():
            self.send_custom_notification(IS_ZENML_INSTALLED, {"is_installed": False})
            self.notify_user("❗ ZenML not detected.", lsp.MessageType.Warning)
            return

        zenml_version = self.get_zenml_version()
        self.send_custom_notification(
            IS_ZENML_INSTALLED, {"is_installed": True, "version": zenml_version}
        )
        # Initializing ZenML client after successful installation check.
        self.log_to_output("🚀 Initializing ZenML client...")
        try:
            self.zenml_client = ZenMLClient()
            self.show_message_log("✅ ZenML client initialized successfully.")
            # register pytool module commands
            self.register_commands()
            # initialize watcher
            self.initialize_global_config_watcher()
        except Exception as e:
            self.notify_user(f"Failed to initialize ZenML client: {str(e)}", lsp.MessageType.Error)

    def initialize_global_config_watcher(self):
        """Sets up and starts the Global Configuration Watcher."""
        try:
            watcher = ZenConfigWatcher(self)
            watcher.watch_zenml_config_yaml()
            self.log_to_output("👀 Watching ZenML configuration for changes.")
        except Exception as e:
            self.notify_user(
                f"Error setting up the Global Configuration Watcher: {e}",
                msg_type=lsp.MessageType.Error,
            )

    def zenml_command(self, wrapper_name=None):
        """
        Decorator for executing commands with ZenMLClient or its specified wrapper.

        This decorator ensures that commands are only executed if ZenMLClient is properly
        initialized. If a `wrapper_name` is provided, the command targets a specific
        wrapper within ZenMLClient; otherwise, it targets ZenMLClient directly.

        Args:
            wrapper_name (str, optional): The specific wrapper within ZenMLClient to target.
                                        Defaults to None, targeting the ZenMLClient itself.
        """

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                client = self.zenml_client
                if not client:
                    self.log_to_output("ZenML client not found in ZenLanguageServer.")
                    return zenml_init_error
                self.log_to_output(f"Executing command with wrapper: {wrapper_name}")
                if not client.initialized:
                    return zenml_init_error

                with suppress_stdout_temporarily():
                    if wrapper_name:
                        wrapper_instance = getattr(self.zenml_client, wrapper_name, None)
                        if not wrapper_instance:
                            return {"error": f"Wrapper '{wrapper_name}' not found."}
                        return func(wrapper_instance, *args, **kwargs)
                    return func(self.zenml_client, *args, **kwargs)

            return wrapper

        return decorator

    def get_zenml_version(self) -> str:
        """Gets the ZenML version."""
        command = [
            self.python_interpreter,
            "-c",
            "import zenml; print(zenml.__version__)",
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        return result.stdout.strip()

    def check_zenml_version(self) -> dict:
        """Checks if the installed ZenML version meets the minimum requirement."""
        version_str = self.get_zenml_version()
        installed_version = parse_version(version_str)
        if installed_version < parse_version(MIN_ZENML_VERSION):
            return self._construct_version_validation_response(False, version_str)

        return self._construct_version_validation_response(True, version_str)

    def _construct_version_validation_response(self, meets_requirement, version_str):
        """Constructs a version validation response."""
        if meets_requirement:
            message = "ZenML version requirement is met."
            status = {"message": message, "version": version_str, "is_valid": True}
        else:
            message = f"Supported versions >= {MIN_ZENML_VERSION}. Found version {version_str}."
            status = {"message": message, "version": version_str, "is_valid": False}

        self.send_custom_notification("zenml/version", status)
        self.notify_user(message)
        return status

    def send_custom_notification(self, method: str, args: dict):
        """Sends a custom notification to the LSP client."""
        self.show_message_log(f"Sending custom notification: {method} with args: {args}")
        self.send_notification(method, args)

    def update_python_interpreter(self, interpreter_path):
        """Updates the Python interpreter path and handles errors."""
        try:
            self.python_interpreter = interpreter_path
            self.show_message_log(f"LSP_Python_Interpreter Updated: {self.python_interpreter}")
        # pylint: disable=broad-exception-caught
        except Exception as e:
            self.show_message_log(
                f"Failed to update Python interpreter: {str(e)}", lsp.MessageType.Error
            )

    def notify_user(self, message: str, msg_type: lsp.MessageType = lsp.MessageType.Info):
        """Logs a message and also notifies the user."""
        self.show_message(message, msg_type)

    def log_to_output(self, message: str, msg_type: lsp.MessageType = lsp.MessageType.Log) -> None:
        """Log to output."""
        self.show_message_log(message, msg_type)

    def register_commands(self):
        """Registers ZenML Python Tool commands."""

        @self.command(f"{TOOL_MODULE_NAME}.getGlobalConfig")
        @self.zenml_command(wrapper_name="config_wrapper")
        def get_global_configuration(wrapper_instance, *args, **kwargs) -> dict:
            """Fetches global ZenML configuration settings."""
            return wrapper_instance.get_global_configuration()

        @self.command(f"{TOOL_MODULE_NAME}.getGlobalConfigFilePath")
        @self.zenml_command(wrapper_name="config_wrapper")
        def get_global_config_file_path(wrapper_instance, *args, **kwargs):
            """Retrieves the file path of the global ZenML configuration."""
            return wrapper_instance.get_global_config_file_path()

        @self.command(f"{TOOL_MODULE_NAME}.serverInfo")
        @self.zenml_command(wrapper_name="zen_server_wrapper")
        def get_server_info(wrapper_instance, *args, **kwargs):
            """Gets information about the ZenML server."""
            return wrapper_instance.get_server_info()

        @self.command(f"{TOOL_MODULE_NAME}.connect")
        @self.zenml_command(wrapper_name="zen_server_wrapper")
        def connect(wrapper_instance, args):
            """Connects to a ZenML server with specified arguments."""
            return wrapper_instance.connect(args)

        @self.command(f"{TOOL_MODULE_NAME}.disconnect")
        @self.zenml_command(wrapper_name="zen_server_wrapper")
        def disconnect(wrapper_instance, *args, **kwargs):
            """Disconnects from the current ZenML server."""
            return wrapper_instance.disconnect(*args, **kwargs)

        @self.command(f"{TOOL_MODULE_NAME}.fetchStacks")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def fetch_stacks(wrapper_instance, args):
            """Fetches a list of all ZenML stacks."""
            return wrapper_instance.fetch_stacks(args)

        @self.command(f"{TOOL_MODULE_NAME}.getActiveStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def get_active_stack(wrapper_instance, *args, **kwargs):
            """Gets the currently active ZenML stack."""
            return wrapper_instance.get_active_stack()

        @self.command(f"{TOOL_MODULE_NAME}.switchActiveStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def set_active_stack(wrapper_instance, args):
            """Sets the active ZenML stack to the specified stack."""
            return wrapper_instance.set_active_stack(args)

        @self.command(f"{TOOL_MODULE_NAME}.renameStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def rename_stack(wrapper_instance, args):
            """Renames a specified ZenML stack."""
            return wrapper_instance.rename_stack(args)

        @self.command(f"{TOOL_MODULE_NAME}.copyStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def copy_stack(wrapper_instance, args):
            """Copies a specified ZenML stack to a new stack."""
            return wrapper_instance.copy_stack(args)

        @self.command(f"{TOOL_MODULE_NAME}.registerStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def register_stack(wrapper_instance, args):
            """Registers a new ZenML stack."""
            return wrapper_instance.register_stack(args)

        @self.command(f"{TOOL_MODULE_NAME}.updateStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def update_stack(wrapper_instance, args):
            """Updates a specified ZenML stack ."""
            return wrapper_instance.update_stack(args)

        @self.command(f"{TOOL_MODULE_NAME}.deleteStack")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def delete_stack(wrapper_instance, args):
            """Deletes a specified ZenML stack ."""
            return wrapper_instance.delete_stack(args)

        @self.command(f"{TOOL_MODULE_NAME}.registerComponent")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def register_component(wrapper_instance, args):
            """Registers a Zenml stack component"""
            return wrapper_instance.register_component(args)

        @self.command(f"{TOOL_MODULE_NAME}.updateComponent")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def update_component(wrapper_instance, args):
            """Updates a ZenML stack component"""
            return wrapper_instance.update_component(args)

        @self.command(f"{TOOL_MODULE_NAME}.deleteComponent")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def delete_component(wrapper_instance, args):
            """Deletes a specified ZenML stack component"""
            return wrapper_instance.delete_component(args)

        @self.command(f"{TOOL_MODULE_NAME}.listComponents")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def list_components(wrapper_instance, args):
            """Get paginated list of stack components from ZenML"""
            return wrapper_instance.list_components(args)

        @self.command(f"{TOOL_MODULE_NAME}.getComponentTypes")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def get_component_types(wrapper_instance, args):
            """Get list of component types from ZenML"""
            return wrapper_instance.get_component_types()

        @self.command(f"{TOOL_MODULE_NAME}.listFlavors")
        @self.zenml_command(wrapper_name="stacks_wrapper")
        def list_flavors(wrapper_instance, args):
            """Get paginated list of component flavors from ZenML"""
            return wrapper_instance.list_flavors(args)

        @self.command(f"{TOOL_MODULE_NAME}.getPipelineRuns")
        @self.zenml_command(wrapper_name="pipeline_runs_wrapper")
        def fetch_pipeline_runs(wrapper_instance, args):
            """Fetches all ZenML pipeline runs."""
            return wrapper_instance.fetch_pipeline_runs(args)

        @self.command(f"{TOOL_MODULE_NAME}.deletePipelineRun")
        @self.zenml_command(wrapper_name="pipeline_runs_wrapper")
        def delete_pipeline_run(wrapper_instance, args):
            """Deletes a specified ZenML pipeline run."""
            return wrapper_instance.delete_pipeline_run(args)

        @self.command(f"{TOOL_MODULE_NAME}.getPipelineRun")
        @self.zenml_command(wrapper_name="pipeline_runs_wrapper")
        def get_pipeline_run(wrapper_instance, args):
            """Gets a specified ZenML pipeline run."""
            return wrapper_instance.get_pipeline_run(args)

        @self.command(f"{TOOL_MODULE_NAME}.getPipelineRunStep")
        @self.zenml_command(wrapper_name="pipeline_runs_wrapper")
        def get_run_step(wrapper_instance, args):
            """Gets a specified ZenML pipeline run step."""
            return wrapper_instance.get_run_step(args)

        @self.command(f"{TOOL_MODULE_NAME}.getPipelineRunArtifact")
        @self.zenml_command(wrapper_name="pipeline_runs_wrapper")
        def get_run_artifact(wrapper_instance, args):
            """Gets a specified ZenML pipeline artifact"""
            return wrapper_instance.get_run_artifact(args)

        @self.command(f"{TOOL_MODULE_NAME}.getPipelineRunDag")
        @self.zenml_command(wrapper_name="pipeline_runs_wrapper")
        def get_run_dag(wrapper_instance, args):
            """Gets graph data for a specified ZenML pipeline run"""
            return wrapper_instance.get_pipeline_run_graph(args)

        @self.command(f"{TOOL_MODULE_NAME}.listWorkspaces")
        @self.zenml_command(wrapper_name="workspaces_wrapper")
        def list_workspaces(wrapper_instance, args):
            """Lists workspaces from ZenML Pro"""
            return wrapper_instance.list_workspaces(args)

        @self.command(f"{TOOL_MODULE_NAME}.getActiveWorkspace")
        @self.zenml_command(wrapper_name="workspaces_wrapper")
        def get_active_workspace(wrapper_instance, *args, **kwargs):
            """Gets the active workspace for the current user"""
            return wrapper_instance.get_active_workspace()

        @self.command(f"{TOOL_MODULE_NAME}.listProjects")
        @self.zenml_command(wrapper_name="projects_wrapper")
        def list_projects(wrapper_instance, args):
            """Lists projects from ZenML"""
            return wrapper_instance.list_projects(args)

        @self.command(f"{TOOL_MODULE_NAME}.getActiveProject")
        @self.zenml_command(wrapper_name="projects_wrapper")
        def get_active_project(wrapper_instance, *args, **kwargs):
            """Gets the active project for the current user"""
            return wrapper_instance.get_active_project()

        @self.command(f"{TOOL_MODULE_NAME}.setActiveProject")
        @self.zenml_command(wrapper_name="projects_wrapper")
        def set_active_project(wrapper_instance, args):
            """Sets the active project for the current user"""
            result = wrapper_instance.set_active_project(args)
            if not isinstance(result, dict) or "error" not in result:
                # Only send notification if successful
                self.send_custom_notification("zenml/projectChanged", result["id"])
            return result

        @self.command(f"{TOOL_MODULE_NAME}.getProjectByName")
        @self.zenml_command(wrapper_name="projects_wrapper")
        def get_project_by_name(wrapper_instance, args):
            """Gets a project by name"""
            return wrapper_instance.get_project_by_name(args[0])
