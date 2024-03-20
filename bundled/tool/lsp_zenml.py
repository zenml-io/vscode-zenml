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

MIN_ZENML_VERSION = "0.55.2"


class ZenLanguageServer(LanguageServer):
    """ZenML Language Server implementation."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.python_interpreter = sys.executable

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

    def is_zenml_installed(self) -> bool:
        """Checks if ZenML is installed."""
        try:
            subprocess.run(
                [self.python_interpreter, "-c", "import zenml"],
                capture_output=True,
                text=True,
                check=True,
                timeout=10,
            )
            self.show_message_log("ZenML installation check: Successful.")
            return True
        except subprocess.CalledProcessError:
            return False

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

    def send_custom_notification(self, method: str, params: dict):
        """Sends a custom notification to the LSP client."""
        self.show_message_log(
            f"Sending custom notification: {method} with params: {params}"
        )
        self.send_notification(method, params)

    def notify_user(
        self, message: str, msg_type: lsp.MessageType = lsp.MessageType.Info
    ):
        """Logs a message and also notifies the user."""
        self.show_message(message, msg_type)
