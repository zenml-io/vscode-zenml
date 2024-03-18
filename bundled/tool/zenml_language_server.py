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
import subprocess
from packaging.version import parse as parse_version
from pygls.server import LanguageServer
import lsprotocol.types as lsp

MIN_ZENML_VERSION = "0.55.2"


class ZenMLLanguageServer(LanguageServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def check_zenml_version(self) -> bool:
        try:
            result = subprocess.run(
                ["zenml", "--version"], capture_output=True, text=True, check=True
            )

            lines = result.stdout.strip().split("\n")
            # Last line should always be the version, even if a warning message is present
            version_line = lines[-1]
            version_str = version_line.split()[-1]
            version = parse_version(version_str)

            if version < parse_version(MIN_ZENML_VERSION):
                # Installed version is less than the minimum required version
                message = f"ZenML version {MIN_ZENML_VERSION} or higher is required. Found version {version_str}. Please upgrade ZenML."
                self.send_custom_notification(
                    "zenml/ready",
                    {"message": message, "version": version_str, "ready": False},
                )
                self.notify_user(message)
                return False
            else:
                # ZenML is installed and meets the minimum version requirement
                message = "ZenML is installed and meets the version requirement."
                self.send_custom_notification(
                    "zenml/ready",
                    {"message": message, "version": version_str, "ready": True},
                )
                self.notify_user(message)
                return True

        except subprocess.CalledProcessError:
            # ZenML is not installed
            message = "ZenML is not installed. Please install ZenML and reload VS Code."
            self.send_custom_notification(
                "zenml/ready",
                {"message": message, "ready": False},
            )
            self.notify_user(message)
            return False

    def send_custom_notification(self, method: str, params: dict):
        """
        Sends a custom notification to the LSP client.

        Args:
            method (str): The method name of the custom notification.
            params (dict): The parameters to send with the notification.
        """
        self.show_message_log(
            f"Sending custom notification: {method} with params: {params}"
        )
        self.send_notification(method, params)

    def notify_user(
        self, message: str, msg_type: lsp.MessageType = lsp.MessageType.Info
    ) -> None:
        """Logs a message and also notifies the user."""
        self.show_message(message, msg_type)
