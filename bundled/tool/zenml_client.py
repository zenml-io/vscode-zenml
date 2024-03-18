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

import logging
import sys
import pathlib
import os
import urllib.parse
import json


class ZenMLClient:
    def __init__(self):
        # Redirect stdout to suppress output from ZenML
        original_stdout = sys.stdout
        logging.basicConfig(stream=sys.stderr, level=logging.INFO)
        sys.stdout = open(os.devnull, "w")

        try:
            from zenml.client import Client
            from zenml.config.global_config import GlobalConfiguration
            from zenml.zen_stores.rest_zen_store import RestZenStoreConfiguration
            from zenml.zen_server.deploy.deployer import ServerDeployer
            from zenml.enums import StoreType
            from zenml.zen_server.utils import get_active_deployment
            from zenml.utils.io_utils import get_global_config_directory
            from zenml.cli import web_login
            from zenml.io import fileio
            from zenml.zen_stores.base_zen_store import BaseZenStore
            from zenml.exceptions import IllegalOperationError, ZenKeyError

            self.client = Client()
            self.gc = GlobalConfiguration()
            self.RestZenStoreConfiguration = RestZenStoreConfiguration
            self.IllegalOperationError = IllegalOperationError
            self.ZenKeyError = ZenKeyError
            self.StoreType = StoreType
            self.ServerDeployer = ServerDeployer
            self.get_active_deployment = get_active_deployment
            self.web_login = web_login
            self.fileio = fileio
            self.BaseZenStore = BaseZenStore
            self.get_global_config_directory = get_global_config_directory

        finally:
            # Restore original stdout
            sys.stdout.close()
            sys.stdout = original_stdout

    def get_global_config_directory_path(self) -> str:
        config_dir = pathlib.Path(self.get_global_config_directory())
        if self.fileio.exists(str(config_dir)):
            return str(config_dir)
        else:
            return "Configuration directory does not exist."

    @staticmethod
    def path_to_uri(file_path):
        path = pathlib.Path(file_path).resolve()
        return urllib.parse.urljoin("file:", urllib.request.pathname2url(str(path)))

    # *** Configuration methods ***
    def get_global_config_file_path(self) -> str:
        config_dir = pathlib.Path(self.get_global_config_directory())
        config_path = config_dir / "config.yaml"
        if self.fileio.exists(str(config_path)):
            return str(config_path)
        else:
            return "Configuration file does not exist."

    def fetch_active_user(self):
        active_user = self.gc.zen_store.get_user()
        return {"id": active_user.id, "name": active_user.name}

    def set_store_configuration(self, remote_url: str, access_token: str):
        new_store_config = self.RestZenStoreConfiguration(
            type="rest", url=remote_url, api_token=access_token, verify_ssl=True
        )
        self.gc.set_store(new_store_config)

    def get_global_configuration(self) -> dict:
        gc_dict = json.loads(self.gc.json(indent=2))
        user_id = gc_dict.get("user_id", "")

        if user_id and user_id.startswith("UUID('") and user_id.endswith("')"):
            gc_dict["user_id"] = user_id[6:-2]

        return gc_dict

    # *** Server methods ***
    def get_server_info(self) -> dict:
        store_info = json.loads(self.gc.zen_store.get_store_info().json(indent=2))
        store_config = json.loads(self.gc.store_configuration.json(indent=2))
        return {"storeInfo": store_info, "storeConfig": store_config}

    def connect(self, args) -> dict:
        url = args[0]
        verify_ssl = args[1] if len(args) > 1 else True

        if not url:
            return {"error": "Server URL is required."}

        try:
            access_token = self.web_login(url=url, verify_ssl=verify_ssl)
            self.set_store_configuration(remote_url=url, access_token=access_token)
            return {"message": "Connected successfully.", "access_token": access_token}
        except Exception as e:
            return {"error": str(e)}

    def disconnect(self) -> dict:
        try:
            url = self.gc.store_configuration.url
            store_type = self.BaseZenStore.get_store_type(url)

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
        except Exception as e:
            return {"error": f"Failed to disconnect: {str(e)}"}

    # *** Stack methods ***
    def fetch_stacks(self) -> dict:
        stacks = self.client.list_stacks(hydrate=True)
        stacks_data = [
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

        return stacks_data

    def get_active_stack(self) -> dict:
        try:
            active_stack = self.client.active_stack_model
            return {
                "id": str(active_stack.id),
                "name": active_stack.name,
            }
        except Exception as e:
            return {"error": f"Failed to retrieve active stack: {str(e)}"}

    def set_active_stack(self, args) -> dict:
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
        """Renames a specified ZenML stack."""
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
        """
        Copies a specified ZenML stack to a new stack with a given name.

        Args:
            'source_stack_name_or_id' (the name or ID of the stack to copy) and
            'target_stack' (the name for the new copied stack).

        Returns:
            JSON response with 'message' indicating success or 'error' on failure.
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
                "message": f"Stack `{source_stack_name_or_id}` successfully copied to `{target_stack_name}`!"
            }
        except self.ZenKeyError as err:
            return {"error": str(err)}
        except Exception as e:
            return {"error": str(e)}

    # *** Pipeline Run methods ***
    def fetch_pipeline_runs(self):
        """List all pipeline runs.
        Returns:
            A page with Pipeline Runs fitting the filter description
        """
        hydrated_runs = self.client.list_pipeline_runs(hydrate=True)

        runs = [
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
                    run.metadata.end_time.isoformat() if run.metadata.end_time else None
                ),
                "os": run.metadata.client_environment["os"],
                "osVersion": run.metadata.client_environment["mac_version"],
                "pythonVersion": run.metadata.client_environment["python_version"],
            }
            for run in hydrated_runs.items
        ]

        return runs

    def delete_pipeline_run(self, args) -> dict:
        try:
            run_id = args[0]
            self.client.delete_pipeline_run(run_id)
            return {"message": f"Pipeline run `{run_id}` deleted successfully."}
        except Exception as e:
            return {"error": f"Failed to delete pipeline run: {str(e)}"}
