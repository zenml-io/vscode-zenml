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
from typing import Any, Dict, List, Optional, Tuple

from constants import TOOL_DISPLAY_NAME, TOOL_MODULE_NAME, ZENML_CLIENT_INITIALIZED


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
import lsp_jsonrpc as jsonrpc  # noqa: E402
import lsprotocol.types as lsp  # noqa: E402
from lsp_zenml import ZenLanguageServer  # noqa: E402
from pygls import uris, workspace  # noqa: E402

WORKSPACE_SETTINGS: Dict[str, Any] = {}
GLOBAL_SETTINGS: Dict[str, Any] = {}
RUNNER = pathlib.Path(__file__).parent / "lsp_runner.py"

MAX_WORKERS = 5

LSP_SERVER = ZenLanguageServer(name="zen-language-server", version="0.0.1", max_workers=MAX_WORKERS)

# **********************************************************
# Tool specific code goes below this.
# **********************************************************
TOOL_MODULE = TOOL_MODULE_NAME
TOOL_DISPLAY = TOOL_DISPLAY_NAME
# Default arguments always passed to zenml. (Not currently used)
TOOL_ARGS: List[str] = []
# Versions of zenml found by workspace
VERSION_LOOKUP: Dict[str, Tuple[int, int, int]] = {}


# **********************************************************
# Required Language Server Initialization and Exit handlers.
# **********************************************************
@LSP_SERVER.feature(lsp.INITIALIZE)
async def initialize(params: lsp.InitializeParams) -> None:
    """LSP handler for initialize request."""
    # pylint: disable=global-statement
    log_to_output(f"CWD Server: {os.getcwd()}")

    paths = "\r\n   ".join(sys.path)
    log_to_output(f"sys.path used to run Server:\r\n   {paths}")

    # Check if initialization_options is a dictionary and update GLOBAL_SETTINGS safely
    if isinstance(params.initialization_options, dict):
        global_settings = params.initialization_options.get("globalSettings", {})
        if isinstance(global_settings, dict):
            GLOBAL_SETTINGS.update(**global_settings)

        # Safely access 'settings' from initialization_options if present
        settings = params.initialization_options.get("settings")
        if settings is not None:
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

    log_to_output("ZenML LSP is initializing.")
    LSP_SERVER.send_custom_notification("sanityCheck", "ZenML LSP is initializing.")

    # Below is not needed as the interpreter path gets automatically updated when changed in vscode.
    # interpreter_path = WORKSPACE_SETTINGS[os.getcwd()]["interpreter"][0]
    # LSP_SERVER.update_python_interpreter(interpreter_path)

    # Check install status and initialize ZenML client if ZenML is installed.
    await LSP_SERVER.initialize_zenml_client()

    # Wait for 5 secondsto allow the language client to setup and settle down client side.
    ready_status = {"ready": True} if LSP_SERVER.zenml_client else {"ready": False}
    LSP_SERVER.send_custom_notification(ZENML_CLIENT_INITIALIZED, ready_status)


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
def log_to_output(message: str, msg_type: lsp.MessageType = lsp.MessageType.Log) -> None:
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
