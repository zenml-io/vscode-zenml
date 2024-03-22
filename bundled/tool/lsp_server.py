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
"""Implementation of tool support over LSP."""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
from functools import wraps
import yaml

from typing import Any, Dict, Optional, Tuple
import time


# **********************************************************
# Update sys.path before importing any bundled libraries.
# **********************************************************
def update_sys_path(path_to_add: str, strategy: str) -> None:
    """Add given path to `sys.path`."""
    if path_to_add not in sys.path and os.path.isdir(path_to_add):
        if strategy == "useBundled":
            sys.path.insert(0, path_to_add)
        elif strategy == "fromEnvironment":
            sys.path.append(path_to_add)


# Ensure that we can import LSP libraries, and other bundled libraries.
update_sys_path(
    os.fspath(pathlib.Path(__file__).parent.parent / "libs"),
    os.getenv("LS_IMPORT_STRATEGY", "useBundled"),
)


# **********************************************************
# Imports needed for the language server goes below this.
# **********************************************************
# pylint: disable=wrong-import-position,import-error
import lsp_jsonrpc as jsonrpc
import lsprotocol.types as lsp
from lsp_zenml import ZenLanguageServer
from pygls import uris, workspace
from zenml_client import ZenMLClient
from lazy_import import suppress_stdout_stderr

WORKSPACE_SETTINGS = {}
GLOBAL_SETTINGS = {}
RUNNER = pathlib.Path(__file__).parent / "lsp_runner.py"

MAX_WORKERS = 5

LSP_SERVER = ZenLanguageServer(
    name="zen-language-server", version="0.0.1", max_workers=MAX_WORKERS
)

# **********************************************************
# Tool specific code goes below this.
# **********************************************************
TOOL_MODULE = "zenml-python"
TOOL_DISPLAY = "ZenML"

# Default arguments always passed to zenml.
TOOL_ARGS = []

# Minimum version of zenml supported.
MIN_ZENML_VERSION = "0.55.0"

# Versions of zenml found by workspace
VERSION_LOOKUP: Dict[str, Tuple[int, int, int]] = {}

zenml_client = None
zenml_initialized = False
zenml_init_error = {
    "error": "ZenML is not initialized. Please check ZenML version requirements."
}
python_interpreter = sys.executable


# **********************************************************
# ZenML Installation Check
# **********************************************************
def is_zenml_installed() -> bool:
    """Checks if ZenML is installed."""
    try:
        subprocess.run(
            [python_interpreter, "-c", "import zenml"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,  # Timeout after 10 seconds
        )
        LSP_SERVER.show_message_log("ZenML installation check: Successful.")
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


# **********************************************************
# ConfigFileChangeHandler: Observe config.yaml changes
# **********************************************************
# pylint: disable=wrong-import-position,import-error
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


class GlobalConfigWatcher(FileSystemEventHandler):
    """
    Watches for changes in the ZenML global configuration file.

    Upon modification of the global configuration file, it triggers notifications
    to update server details accordingly.
    """

    last_event_time = 0
    debounce_interval = 2
    last_known_url = ""
    last_known_stack_id = ""

    def on_modified(self, event):
        """
        Handles the modification event triggered when the global configuration file is changed.

        It checks if the modification event occurs after the debounce interval to avoid
        processing rapid, successive changes. It then compares the new server URL and
        stack ID against the last known values to determine if a change has occurred.
        If a change is detected, it sends a custom notification to the LSP server with the
        updated configuration details.

        Parameters:
            event (FileSystemEvent): The event object representing the file modification.

        Notes:
            If the time since the last event is less than the debounce interval, or if there
            are no significant changes in the server URL or active stack ID, the method will
            return early without sending any notifications.
        """
        current_time = time.time()
        if (current_time - self.last_event_time) < self.debounce_interval:
            return
        with suppress_stdout_stderr():
            config_file_path = zenml_client.config_wrapper.get_global_config_file_path()
            if event.src_path == str(config_file_path):
                try:
                    with open(config_file_path, "r") as f:
                        config = yaml.safe_load(f)
                        new_url = config.get("store", {}).get("url", "")
                        new_stack_id = config.get("active_stack_id", "")

                        url_changed = new_url != self.last_known_url
                        if url_changed:
                            server_details = {
                                "url": new_url,
                                "api_token": config.get("store", {}).get(
                                    "api_token", ""
                                ),
                                "store_type": config.get("store", {}).get("type", ""),
                            }
                            LSP_SERVER.send_custom_notification(
                                "zenml/serverChanged",
                                server_details,
                            )
                            self.last_known_url = new_url

                        stack_id_changed = new_stack_id != self.last_known_stack_id
                        if stack_id_changed:
                            LSP_SERVER.send_custom_notification(
                                "zenml/stackChanged", new_stack_id
                            )
                            self.last_known_stack_id = new_stack_id

                        if url_changed or stack_id_changed:
                            self.last_event_time = current_time
                except Exception as e:
                    LSP_SERVER.show_message_log(f"Failed to get server info: {e}")


def watch_zenml_config_yaml():
    """
    Initializes and starts a file watcher on the ZenML global configuration directory.
    Upon detecting a change, it triggers handlers to process these changes.
    """

    config_dir_path = zenml_client.config_wrapper.get_global_config_directory_path()

    if os.path.isdir(config_dir_path):
        try:
            os.listdir(config_dir_path)
        except OSError as e:
            log_error(f"Error starting file watcher on {config_dir_path}: {e}.")
        else:
            observer = Observer()
            event_listener = GlobalConfigWatcher()
            observer.schedule(event_listener, config_dir_path, recursive=False)
            observer.start()
            log_to_output(f"Started watching {config_dir_path} for changes.")
    else:
        log_error("Configuration directory path does not exist or is not a directory.")


# **********************************************************
# ZenML Client LSP Commands
# **********************************************************
def zenml_command(wrapper_name=None):
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
            log_to_output(f"Executing command with wrapper: {wrapper_name}")
            if not zenml_initialized or not zenml_client:
                return zenml_init_error

            with suppress_stdout_stderr():
                if wrapper_name:
                    wrapper_instance = getattr(zenml_client, wrapper_name, None)
                    if not wrapper_instance:
                        return {"error": f"Wrapper '{wrapper_name}' not found."}
                    return func(wrapper_instance, *args, **kwargs)
                return func(zenml_client, *args, **kwargs)

        return wrapper

    return decorator


@LSP_SERVER.command(f"{TOOL_MODULE}.getGlobalConfig")
@zenml_command(wrapper_name="config_wrapper")
def get_global_configuration(wrapper_instance, *args, **kwargs) -> dict:
    """Fetches global ZenML configuration settings."""
    return wrapper_instance.get_global_configuration()


@LSP_SERVER.command(f"{TOOL_MODULE}.getGlobalConfigFilePath")
@zenml_command(wrapper_name="config_wrapper")
def get_global_config_file_path(wrapper_instance, *args, **kwargs) -> str:
    """Retrieves the file path of the global ZenML configuration."""
    return wrapper_instance.get_global_config_file_path()


@LSP_SERVER.command(f"{TOOL_MODULE}.serverInfo")
@zenml_command(wrapper_name="zen_server_wrapper")
def get_server_info(wrapper_instance, *args, **kwargs) -> dict:
    """Gets information about the ZenML server."""
    return wrapper_instance.get_server_info()


@LSP_SERVER.command(f"{TOOL_MODULE}.connect")
@zenml_command(wrapper_name="zen_server_wrapper")
def connect(wrapper_instance, args, **kwargs) -> dict:
    """Connects to a ZenML server with specified arguments."""
    return wrapper_instance.connect(args)


@LSP_SERVER.command(f"{TOOL_MODULE}.disconnect")
@zenml_command(wrapper_name="zen_server_wrapper")
def disconnect(wrapper_instance, args, **kwargs) -> dict:
    """Disconnects from the current ZenML server."""
    return wrapper_instance.disconnect(args)


@LSP_SERVER.command(f"{TOOL_MODULE}.fetchStacks")
@zenml_command(wrapper_name="stacks_wrapper")
def fetch_stacks(wrapper_instance, *args, **kwargs):
    """Fetches a list of all ZenML stacks."""
    return wrapper_instance.fetch_stacks()


@LSP_SERVER.command(f"{TOOL_MODULE}.getActiveStack")
@zenml_command(wrapper_name="stacks_wrapper")
def get_active_stack(wrapper_instance, *args, **kwargs) -> dict:
    """Gets the currently active ZenML stack."""
    return wrapper_instance.get_active_stack()


@LSP_SERVER.command(f"{TOOL_MODULE}.switchActiveStack")
@zenml_command(wrapper_name="stacks_wrapper")
def set_active_stack(wrapper_instance, args) -> dict:
    """Sets the active ZenML stack to the specified stack."""
    return wrapper_instance.set_active_stack(args)


@LSP_SERVER.command(f"{TOOL_MODULE}.renameStack")
@zenml_command(wrapper_name="stacks_wrapper")
def rename_stack(wrapper_instance, args) -> dict:
    """Renames a specified ZenML stack."""
    return wrapper_instance.rename_stack(args)


@LSP_SERVER.command(f"{TOOL_MODULE}.copyStack")
@zenml_command(wrapper_name="stacks_wrapper")
def copy_stack(wrapper_instance, args) -> dict:
    """Copies a specified ZenML stack to a new stack."""
    return wrapper_instance.copy_stack(args)


@LSP_SERVER.command(f"{TOOL_MODULE}.getPipelineRuns")
@zenml_command(wrapper_name="pipeline_runs_wrapper")
def fetch_pipeline_runs(wrapper_instance, *args, **kwargs):
    """Fetches all ZenML pipeline runs."""
    return wrapper_instance.fetch_pipeline_runs()


@LSP_SERVER.command(f"{TOOL_MODULE}.deletePipelineRun")
@zenml_command(wrapper_name="pipeline_runs_wrapper")
def delete_pipeline_run(wrapper_instance, args) -> dict:
    """Deletes a specified ZenML pipeline run."""
    return wrapper_instance.delete_pipeline_run(args)


@LSP_SERVER.command(f"{TOOL_MODULE}.checkZenMLInstallation")
def check_zenml_installation(*args, **kwargs) -> None:
    """Handles a request from the client to check the ZenML installation."""
    result = is_zenml_installed()
    LSP_SERVER.send_custom_notification("zenml/ready", {"ready": result})
    return result


# **********************************************************
# Required Language Server Initialization and Exit handlers.
# **********************************************************
@LSP_SERVER.feature(lsp.INITIALIZE)
def initialize(params: lsp.InitializeParams) -> None:
    """LSP handler for initialize request."""
    # pylint: disable=global-statement
    global zenml_client, zenml_initialized

    log_to_output(f"CWD Server: {os.getcwd()}")

    paths = "\r\n   ".join(sys.path)
    log_to_output(f"sys.path used to run Server:\r\n   {paths}")

    GLOBAL_SETTINGS.update(**params.initialization_options.get("globalSettings", {}))

    settings = params.initialization_options["settings"]
    _update_workspace_settings(settings)
    log_to_output(
        f"Settings used to run Server:\r\n{json.dumps(settings, indent=4, ensure_ascii=False)}\r\n"
    )
    log_to_output(
        f"Global settings:\r\n{json.dumps(GLOBAL_SETTINGS, indent=4, ensure_ascii=False)}\r\n"
    )
    log_to_output(
        f"Workspace settings:\r\n{json.dumps(WORKSPACE_SETTINGS, indent=4, ensure_ascii=False)}\r\n"
    )

    LSP_SERVER.send_custom_notification(
        "sanityCheck", {"message": "ZenML Language Server is initializing."}
    )

    # Update the Python interpreter to the one used by the client.
    interpreter_path = WORKSPACE_SETTINGS["/"]["interpreter"][0]
    LSP_SERVER.update_python_interpreter(interpreter_path)

    if LSP_SERVER.is_zenml_installed():
        zenml_client = ZenMLClient()
        zenml_initialized = True
        LSP_SERVER.send_custom_notification("zenml/ready", {"ready": True})
        log_to_output("ZenML is installed and ready.")
    else:
        zenml_initialized = False
        LSP_SERVER.send_notification("zenml/ready", {"ready": False})
        log_to_output(
            "LSP: ZenML not found. Please select a Python interpreter with ZenML installed."
        )
    if zenml_initialized:
        watch_zenml_config_yaml()
    else:
        log_to_output("Skipping file watch due to ZenML version check failure.")


@LSP_SERVER.feature(lsp.EXIT)
def on_exit(_params: Optional[Any] = None) -> None:
    """Handle clean up on exit."""
    jsonrpc.shutdown_json_rpc()


@LSP_SERVER.feature(lsp.SHUTDOWN)
def on_shutdown(_params: Optional[Any] = None) -> None:
    """Handle clean up on shutdown."""
    jsonrpc.shutdown_json_rpc()


# *****************************************************
# Internal functional and settings management APIs.
# *****************************************************
def _get_global_defaults():
    return {
        "path": GLOBAL_SETTINGS.get("path", []),
        "interpreter": GLOBAL_SETTINGS.get("interpreter", [sys.executable]),
        "args": GLOBAL_SETTINGS.get("args", []),
        "importStrategy": GLOBAL_SETTINGS.get("importStrategy", "useBundled"),
        "showNotifications": GLOBAL_SETTINGS.get("showNotifications", "off"),
    }


def _update_workspace_settings(settings):
    if not settings:
        key = os.getcwd()
        WORKSPACE_SETTINGS[key] = {
            "cwd": key,
            "workspaceFS": key,
            "workspace": uris.from_fs_path(key),
            **_get_global_defaults(),
        }
        return

    for setting in settings:
        key = uris.to_fs_path(setting["workspace"])
        WORKSPACE_SETTINGS[key] = {
            "cwd": key,
            **setting,
            "workspaceFS": key,
        }


# *****************************************************
# Internal execution APIs.
# *****************************************************
def get_cwd(settings: Dict[str, Any], document: Optional[workspace.Document]) -> str:
    """Returns cwd for the given settings and document."""
    if settings["cwd"] == "${workspaceFolder}":
        return settings["workspaceFS"]

    if settings["cwd"] == "${fileDirname}":
        if document is not None:
            return os.fspath(pathlib.Path(document.path).parent)
        return settings["workspaceFS"]

    return settings["cwd"]


# *****************************************************
# Logging and notification.
# *****************************************************
def log_to_output(
    message: str, msg_type: lsp.MessageType = lsp.MessageType.Log
) -> None:
    """Log to output."""
    LSP_SERVER.show_message_log(message, msg_type)


def log_error(message: str) -> None:
    """Log error."""
    LSP_SERVER.show_message_log(message, lsp.MessageType.Error)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onError", "onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Error)


def log_warning(message: str) -> None:
    """Log warning."""
    LSP_SERVER.show_message_log(message, lsp.MessageType.Warning)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Warning)


def log_always(message: str) -> None:
    """Log message."""
    LSP_SERVER.show_message_log(message, lsp.MessageType.Info)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Info)


# *****************************************************
# Start the server.
# *****************************************************
if __name__ == "__main__":
    LSP_SERVER.start_io()
