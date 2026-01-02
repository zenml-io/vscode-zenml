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
ZenML Global Configuration Watcher.

This module contains ZenConfigWatcher, a class that watches for changes
in the ZenML global configuration file and triggers notifications accordingly.
"""

import os
from threading import Timer
from typing import Any, Optional

import yaml
from constants import ZENML_PROJECT_CHANGED, ZENML_SERVER_CHANGED, ZENML_STACK_CHANGED
from lazy_import import suppress_stdout_temporarily
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


class ZenConfigWatcher(FileSystemEventHandler):
    """
    Watches for changes in the ZenML global configuration file.

    Upon modification of the global configuration file, it triggers notifications
    to update config details accordingly.
    """

    def __init__(self, lsp_server):
        super().__init__()
        self.LSP_SERVER = lsp_server
        self.observer: Optional[Any] = None
        self.debounce_interval: float = 2.0
        self._timer: Optional[Timer] = None
        self.last_known_url: str = ""
        self.last_known_stack_id: str = ""
        self.last_known_project_name: str = ""
        self.show_notification: bool = os.getenv("LS_SHOW_NOTIFICATION", "off") in [
            "onError",
            "onWarning",
            "always",
        ]

        try:
            with suppress_stdout_temporarily():
                config_wrapper_instance = self.LSP_SERVER.zenml_client.config_wrapper
                self.config_path = config_wrapper_instance.get_global_config_file_path()
        except Exception as e:
            self.log_error(f"Failed to retrieve global config file path: {e}")

    def process_config_change(self, config_file_path: str):
        """Process the configuration file change."""
        with suppress_stdout_temporarily():
            try:
                with open(config_file_path, "r") as f:
                    config = yaml.safe_load(f)

                    new_url = config.get("store", {}).get("url", "")
                    new_stack_id = config.get("active_stack_id", "")
                    new_project_name = config.get("active_project_name", "")

                    url_changed = new_url != self.last_known_url
                    stack_id_changed = new_stack_id != self.last_known_stack_id
                    project_name_changed = new_project_name != self.last_known_project_name

                    # Send ZENML_SERVER_CHANGED if url changed
                    if url_changed:
                        server_details = {
                            "url": new_url,
                            "api_token": config.get("store", {}).get("api_token", ""),
                            "store_type": config.get("store", {}).get("type", ""),
                        }
                        self.LSP_SERVER.send_custom_notification(
                            ZENML_SERVER_CHANGED,
                            server_details,
                        )
                        self.last_known_url = new_url

                    # Send ZENML_STACK_CHANGED if stack_id changed
                    if stack_id_changed:
                        self.LSP_SERVER.send_custom_notification(ZENML_STACK_CHANGED, new_stack_id)
                        self.last_known_stack_id = new_stack_id

                    # Send ZENML_PROJECT_CHANGED if project_name changed
                    if project_name_changed and new_project_name:
                        self.LSP_SERVER.send_custom_notification(
                            ZENML_PROJECT_CHANGED, new_project_name
                        )
                        self.last_known_project_name = new_project_name
            except (FileNotFoundError, PermissionError) as e:
                self.log_error(f"Configuration file access error: {e} - {config_file_path}")
            except yaml.YAMLError as e:
                self.log_error(f"YAML parsing error in configuration: {e} - {config_file_path}")
            except Exception as e:
                self.log_error(f"Unexpected error while monitoring configuration: {e}")

    def on_modified(self, event):
        """
        Handles the modification event triggered when the global configuration file is changed.
        """
        if event.src_path != self.config_path:
            return

        if self._timer is not None:
            self._timer.cancel()

        self._timer = Timer(self.debounce_interval, self.process_event, [event])
        self._timer.start()

    def process_event(self, event):
        """
        Processes the event with a debounce mechanism.
        """
        self.process_config_change(event.src_path)

    def watch_zenml_config_yaml(self):
        """
        Initializes and starts a file watcher on the ZenML global configuration directory.
        Upon detecting a change, it triggers handlers to process these changes.
        """
        config_wrapper_instance = self.LSP_SERVER.zenml_client.config_wrapper
        config_dir_path = config_wrapper_instance.get_global_config_directory_path()

        # Check if config_dir_path is valid and readable
        if os.path.isdir(config_dir_path) and os.access(config_dir_path, os.R_OK):
            try:
                self.observer = Observer()
                self.observer.schedule(self, config_dir_path, recursive=False)
                self.observer.start()
                self.LSP_SERVER.log_to_output(f"Started watching {config_dir_path} for changes.")
            except Exception as e:
                self.log_error(f"Failed to start file watcher: {e}")
        else:
            self.log_error("Config directory path invalid or missing.")

    def stop_watching(self):
        """
        Stops the file watcher gracefully.
        """
        if self.observer is not None:
            self.observer.stop()
            self.observer.join()  # waits for observer to fully stop
            self.LSP_SERVER.log_to_output("Stopped watching config directory for changes.")

    def log_error(self, message: str):
        """Log error."""
        self.LSP_SERVER.show_message_log(message, 1)
        if self.show_notification:
            self.LSP_SERVER.show_message(message, 1)
