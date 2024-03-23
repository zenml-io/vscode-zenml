# **********************************************************
# ConfigFileChangeHandler: Observe config.yaml changes
# **********************************************************
# pylint: disable=wrong-import-position,import-error
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from lazy_import import suppress_stdout_stderr
import time
import yaml
import os


class ZenConfigWatcher(FileSystemEventHandler):
    """
    Watches for changes in the ZenML global configuration file.

    Upon modification of the global configuration file, it triggers notifications
    to update server details accordingly.
    """

    last_event_time = 0
    debounce_interval = 2
    last_known_url = ""
    last_known_stack_id = ""

    def __init__(self, lsp_server):
        super().__init__()
        self.LSP_SERVER = lsp_server

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
            config_wrapper_instance = self.LSP_SERVER.zenml_client.config_wrapper
            config_file_path = config_wrapper_instance.get_global_config_file_path()
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
                            self.LSP_SERVER.send_custom_notification(
                                "zenml/serverChanged",
                                server_details,
                            )
                            self.last_known_url = new_url

                        stack_id_changed = new_stack_id != self.last_known_stack_id
                        if stack_id_changed:
                            self.LSP_SERVER.send_custom_notification(
                                "zenml/stackChanged", new_stack_id
                            )
                            self.last_known_stack_id = new_stack_id

                        if url_changed or stack_id_changed:
                            self.last_event_time = current_time
                except Exception as e:
                    self.LSP_SERVER.show_message_log(f"Failed to get server info: {e}")

    def watch_zenml_config_yaml(self):
        """
        Initializes and starts a file watcher on the ZenML global configuration directory.
        Upon detecting a change, it triggers handlers to process these changes.
        """
        config_wrapper_instance = self.LSP_SERVER.zenml_client.config_wrapper
        config_dir_path = config_wrapper_instance.get_global_config_directory_path()

        if os.path.isdir(config_dir_path):
            try:
                os.listdir(config_dir_path)
            except OSError as e:
                self.LSP_SERVER.log_error(
                    f"Error starting file watcher on {config_dir_path}: {e}."
                )
            else:
                observer = Observer()
                observer.schedule(self, config_dir_path, recursive=False)
                observer.start()
                self.LSP_SERVER.log_to_output(
                    f"Started watching {config_dir_path} for changes."
                )
        else:
            self.LSP_SERVER.log_error(
                "Configuration directory path does not exist or is not a directory."
            )

    def log_error(self, message: str) -> None:
        """Log error."""
        self.LSP_SERVER.show_message_log(message, 1)
        if os.getenv("LS_SHOW_NOTIFICATION", "off") in [
            "onError",
            "onWarning",
            "always",
        ]:
            self.LSP_SERVER.show_message(message, 1)
