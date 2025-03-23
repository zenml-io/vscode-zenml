#  Copyright (c) ZenML GmbH 2024. All Rights Reserved.
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at:
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressc
#  or implied. See the License for the specific language governing
#  permissions and limitations under the License.
"""ZenML client class. Initializes all wrappers."""


class ZenMLClient:
    """Provides a high-level interface to ZenML functionalities by wrapping core components."""

    def __init__(self):
        """
        Initializes the ZenMLClient with wrappers for managing configurations,
        server interactions, stacks, and pipeline runs.
        """
        # pylint: disable=wrong-import-position,import-error
        from lazy_import import lazy_import, suppress_stdout_temporarily
        from zenml_wrappers import (
            GlobalConfigWrapper,
            PipelineRunsWrapper,
            ProjectsWrapper,
            StacksWrapper,
            WorkspacesWrapper,
            ZenServerWrapper,
        )

        # Suppress colorful warnings during client initialization
        with suppress_stdout_temporarily():
            self.client = lazy_import("zenml.client", "Client")()

        # initialize zenml library wrappers
        self.config_wrapper = GlobalConfigWrapper()
        self.stacks_wrapper = StacksWrapper(self.client)
        self.pipeline_runs_wrapper = PipelineRunsWrapper(self.client)
        self.workspaces_wrapper = WorkspacesWrapper(self.client, self.config_wrapper)
        self.projects_wrapper = ProjectsWrapper(self.client)
        self.zen_server_wrapper = ZenServerWrapper(self.config_wrapper, self.projects_wrapper)
        self.initialized = True
