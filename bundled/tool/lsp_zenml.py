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


import subprocess
import sys

import lsprotocol.types as lsp
from packaging.version import parse as parse_version
from pygls.server import LanguageServer
from zenml_client import ZenMLClient
from lazy_import import suppress_stdout_stderr
from functools import wraps
from lazy_import import suppress_stdout_stderr
from zen_watcher import ZenConfigWatcher
import asyncio

MIN_ZENML_VERSION = "0.55.2"
TOOL_MODULE = "zenml-python"

zenml_init_error = {
    "error": "ZenML is not initialized. Please check ZenML version requirements."
}


class ZenLanguageServer(LanguageServer):
    """ZenML Language Server implementation."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.python_interpreter = sys.executable
        self.zenml_client = None
        self.register_commands()

    async def is_zenml_installed(self) -> bool:
        """Asynchronously checks if ZenML is installed."""
        # This is a simplified async version of a check.
        # In real usage, you would replace subprocess.run with an async equivalent.
        try:
            process = await asyncio.create_subprocess_exec(
                self.python_interpreter,
                "-c",
                "import zenml",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await process.wait()
            if process.returncode == 0:
                self.show_message_log("✅ ZenML installation check: Successful.")
                return True
            else:
                self.show_message_log(
                    "❌ ZenML installation check failed.", lsp.MessageType.Error
                )
                return False
        except Exception as e:
            self.show_message_log(
                f"Error checking ZenML installation: {str(e)}", lsp.MessageType.Error
            )
            return False

    async def initialize_zenml_client(self):
        """Initializes the ZenML client."""
        if self.zenml_client is not None:
            # Client is already initialized.
            self.notify_user("⭐️ ZenML Client Already Initialized ⭐️")
            return

        if not await self.is_zenml_installed():
            self.notify_user("❗ ZenML not detected.", lsp.MessageType.Warning)
            return

        # Initializing ZenML client after successful installation check.
        self.notify_user("🚀 Initializing ZenML client...")
        try:
            self.zenml_client = ZenMLClient()
            self.notify_user("✅ ZenML client initialized successfully.")
        except Exception as e:
            self.notify_user(
                f"Failed to initialize ZenML client: {str(e)}", lsp.MessageType.Error
            )

        # Initialize the Global Configuration Watcher.
        self.initialize_global_config_watcher()

    def initialize_global_config_watcher(self):
        """Sets up and starts the Global Configuration Watcher."""
        try:
            watcher = ZenConfigWatcher(self)
            watcher.watch_zenml_config_yaml()
            self.notify_user("👀 Watching ZenML configuration for changes.")
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

                with suppress_stdout_stderr():
                    if wrapper_name:
                        wrapper_instance = getattr(
                            self.zenml_client, wrapper_name, None
                        )
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
        self.show_message_log(
            f"Sending custom notification: {method} with args: {args}"
        )
        self.send_notification(method, args)

    def update_python_interpreter(self, interpreter_path):
        """Updates the Python interpreter path and handles errors."""
        try:
            self.python_interpreter = interpreter_path
            self.show_message_log(
                f"LSP_Python_Interpreter Updated: {self.python_interpreter}"
            )
        # pylint: disable=broad-exception-caught
        except Exception as e:
            self.show_message_log(
                f"Failed to update Python interpreter: {str(e)}", lsp.MessageType.Error
            )

    def notify_user(
        self, message: str, msg_type: lsp.MessageType = lsp.MessageType.Info
    ):
        """Logs a message and also notifies the user."""
        self.show_message(message, msg_type)

    def log_to_output(
        self, message: str, msg_type: lsp.MessageType = lsp.MessageType.Log
    ) -> None:
        """Log to output."""
        self.show_message_log(message, msg_type)

    def register_commands(self):
        @self.command(f"{TOOL_MODULE}.getGlobalConfig")
        def get_global_configuration(args) -> dict:
            """Fetches global ZenML configuration settings."""
            wrapper_instance = self.zenml_client.config_wrapper
            return wrapper_instance.get_global_configuration()

        @self.command(f"{TOOL_MODULE}.getGlobalConfigFilePath")
        def get_global_config_file_path(args):
            """Retrieves the file path of the global ZenML configuration."""
            wrapper_instance = self.zenml_client.config_wrapper
            return wrapper_instance.get_global_config_file_path()

        @self.command(f"{TOOL_MODULE}.serverInfo")
        def get_server_info(args):
            """Gets information about the ZenML server."""
            wrapper_instance = self.zenml_client.zen_server_wrapper
            return wrapper_instance.get_server_info()

        @self.command(f"{TOOL_MODULE}.connect")
        def connect(args):
            """Connects to a ZenML server with specified arguments."""
            wrapper_instance = self.zenml_client.zen_server_wrapper
            return wrapper_instance.connect(args)

        @self.command(f"{TOOL_MODULE}.disconnect")
        def disconnect(args):
            """Disconnects from the current ZenML server."""
            wrapper_instance = self.zenml_client.zen_server_wrapper
            return wrapper_instance.disconnect(args)

        @self.command(f"{TOOL_MODULE}.fetchStacks")
        def fetch_stacks(args):
            """Fetches a list of all ZenML stacks."""
            wrapper_instance = self.zenml_client.stacks_wrapper
            return wrapper_instance.fetch_stacks()

        @self.command(f"{TOOL_MODULE}.getActiveStack")
        def get_active_stack(args):
            """Gets the currently active ZenML stack."""
            wrapper_instance = self.zenml_client.stacks_wrapper
            return wrapper_instance.get_active_stack()

        @self.command(f"{TOOL_MODULE}.switchActiveStack")
        def set_active_stack(args):
            """Sets the active ZenML stack to the specified stack."""
            print(f"args received: {args}")
            wrapper_instance = self.zenml_client.stacks_wrapper
            return wrapper_instance.set_active_stack(args)

        @self.command(f"{TOOL_MODULE}.renameStack")
        def rename_stack(args):
            """Renames a specified ZenML stack."""
            wrapper_instance = self.zenml_client.stacks_wrapper
            return wrapper_instance.rename_stack(args)

        @self.command(f"{TOOL_MODULE}.copyStack")
        def copy_stack(args):
            """Copies a specified ZenML stack to a new stack."""
            wrapper_instance = self.zenml_client.stacks_wrapper
            return wrapper_instance.copy_stack(args)

        @self.command(f"{TOOL_MODULE}.getPipelineRuns")
        def fetch_pipeline_runs(args):
            """Fetches all ZenML pipeline runs."""
            wrapper_instance = self.zenml_client.pipeline_runs_wrapper
            return wrapper_instance.fetch_pipeline_runs()

        @self.command(f"{TOOL_MODULE}.deletePipelineRun")
        def delete_pipeline_run(args):
            """Deletes a specified ZenML pipeline run."""
            wrapper_instance = self.zenml_client.pipeline_runs_wrapper
            return wrapper_instance.delete_pipeline_run(args)
