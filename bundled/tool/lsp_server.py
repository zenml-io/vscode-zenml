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
import sys
from typing import Any, Dict, Optional, Tuple
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from zenml_language_server import ZenMLLanguageServer
from zenml_client import ZenMLClient


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
import lsp_utils as utils
import lsprotocol.types as lsp
from pygls import uris, workspace

WORKSPACE_SETTINGS = {}
GLOBAL_SETTINGS = {}
RUNNER = pathlib.Path(__file__).parent / "lsp_runner.py"

MAX_WORKERS = 5

LSP_SERVER = ZenMLLanguageServer(
    name="zenml-pytool-server", version="0.0.1", max_workers=MAX_WORKERS
)

# **********************************************************
# Tool specific code goes below this.
# **********************************************************

TOOL_MODULE = "zenml-python"
TOOL_DISPLAY = "ZenML Python Tool"

# Default arguments always passed to zenml.
TOOL_ARGS = []

# Minimum version of zenml supported.
# MIN_VERSION = "0.55.2"

# Versions of zenml found by workspace
VERSION_LOOKUP: Dict[str, Tuple[int, int, int]] = {}

zenml_client = None
zenml_initialized = False
zenml_init_error = {
    "error": "ZenML is not initialized. Please check ZenML version requirements."
}


# **********************************************************
# ConfigFileChangeHandler: Observe config.yaml changes
# **********************************************************
class ConfigFileChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path == str(get_global_config_file_path()):
            LSP_SERVER.show_message_log("Configuration file changed.")
            try:
                server_details = zenml_client.get_server_info()
                LSP_SERVER.send_custom_notification(
                    "zenml/configUpdated",
                    {
                        "path": event.src_path,
                        "serverDetails": server_details,
                    },
                )
                LSP_SERVER.show_message_log(
                    "Server information sent after config change."
                )
            except Exception as e:
                LSP_SERVER.show_message_log(f"Failed to get server info: {e}")


def watch_zenml_config_yaml():
    config_dir_path = zenml_client.get_global_config_directory_path()
    if config_dir_path != "Configuration directory does not exist.":
        observer = Observer()
        event_handler = ConfigFileChangeHandler()
        observer.schedule(event_handler, config_dir_path, recursive=False)
        observer.start()
        log_to_output(f"Started watching {config_dir_path} for changes.")
    else:
        log_error("Cannot start file watcher, configuration directory does not exist.")


# **********************************************************
# ZenML Client LSP Commands
# **********************************************************
@LSP_SERVER.command(f"{TOOL_MODULE}.getGlobalConfig")
def get_global_configuration(*args, **kwargs) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.get_global_configuration()
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.getGlobalConfigFilePath")
def get_global_config_file_path(*args, **kwargs) -> str:
    if zenml_initialized and zenml_client:
        return zenml_client.get_global_config_file_path()
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.serverInfo")
def get_server_info(*args, **kwargs) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.get_server_info()
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.connect")
def connect(args) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.connect(args)
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.disconnect")
def disconnect(args) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.disconnect(args)
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.fetchStacks")
def fetch_stacks(*args, **kwargs):
    if zenml_initialized and zenml_client:
        return zenml_client.fetch_stacks()
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.getActiveStack")
def get_active_stack(*args, **kwargs) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.get_active_stack()
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.switchActiveStack")
def set_active_stack(args) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.set_active_stack(args)
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.renameStack")
def rename_stack(args) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.rename_stack(args)
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.copyStack")
def copy_stack(args) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.copy_stack(args)
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.getPipelineRuns")
def fetch_pipeline_runs(*args, **kwargs):
    if zenml_initialized and zenml_client:
        return zenml_client.fetch_pipeline_runs()
    else:
        return zenml_init_error


@LSP_SERVER.command(f"{TOOL_MODULE}.deletePipelineRun")
def delete_pipeline_run(args) -> dict:
    if zenml_initialized and zenml_client:
        return zenml_client.delete_pipeline_run(args)
    else:
        return zenml_init_error


# **********************************************************
# Required Language Server Initialization and Exit handlers.
# **********************************************************
@LSP_SERVER.feature(lsp.INITIALIZE)
def initialize(params: lsp.InitializeParams) -> None:
    """LSP handler for initialize request."""
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

    if LSP_SERVER.check_zenml_version():
        zenml_client = ZenMLClient()
        zenml_initialized = True
        log_to_output("ZenML version check passed. ZenMLClient initialized.")
    else:
        zenml_initialized = False
        log_error("ZenML version check failed. ZenML features will be unavailable.")

    if zenml_initialized:
        watch_zenml_config_yaml()
    else:
        log_error("Skipping file watch due to ZenML version check failure.")


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


def _to_run_result_with_logging(rpc_result: jsonrpc.RpcRunResult) -> utils.RunResult:
    error = ""
    if rpc_result.exception:
        log_error(rpc_result.exception)
        error = rpc_result.exception
    elif rpc_result.stderr:
        log_to_output(rpc_result.stderr)
        error = rpc_result.stderr
    return utils.RunResult(rpc_result.stdout, error)


# *****************************************************
# Logging and notification.
# *****************************************************
def log_to_output(
    message: str, msg_type: lsp.MessageType = lsp.MessageType.Log
) -> None:
    LSP_SERVER.show_message_log(message, msg_type)


def log_error(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Error)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onError", "onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Error)


def log_warning(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Warning)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Warning)


def log_always(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Info)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Info)


# *****************************************************
# Start the server.
# *****************************************************
if __name__ == "__main__":
    LSP_SERVER.start_io()
