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
"""This module contains a tool to mimic LineageGraph output for pipeline runs"""

from typing import Dict, List, Optional

from type_hints import GraphEdge, GraphNode, GraphResponse, StepArtifact


def _get_run_status(run) -> Optional[str]:
    """Get the status from a run, handling model structure changes."""
    if hasattr(run, "body") and run.body is not None:
        status = getattr(run.body, "status", None)
        if status is not None:
            return status
    return getattr(run, "status", None)


def _get_run_pipeline_name(run) -> Optional[str]:
    """Get the pipeline name from a run, handling model structure changes."""
    # Try new location first (0.93.0+): run.resources.pipeline.name
    if hasattr(run, "resources") and run.resources is not None:
        pipeline = getattr(run.resources, "pipeline", None)
        if pipeline is not None and hasattr(pipeline, "name"):
            return pipeline.name

    # Try old location: run.body.pipeline.name
    if hasattr(run, "body") and run.body is not None:
        pipeline = getattr(run.body, "pipeline", None)
        if pipeline is not None and hasattr(pipeline, "name"):
            return pipeline.name

    # Final fallback: use the run's own name
    return getattr(run, "name", None)


class Grapher:
    """Quick and dirty implementation of ZenML/LineageGraph to reduce number of api calls"""

    def __init__(self, run, run_name: Optional[str] = None, run_status: Optional[str] = None):
        self.run = run
        # Allow explicit override of name/status for compatibility
        self._run_name = run_name
        self._run_status = run_status
        self.nodes: List[GraphNode] = []
        self.edges: List[GraphEdge] = []
        self.artifacts: Dict[str, bool] = {}

    def _extract_enum_value(self, enum_obj, default_value: str = "unknown") -> str:
        """Helper method to extract string value from enum objects"""
        if hasattr(enum_obj, "_value_"):
            return str(enum_obj._value_)
        elif hasattr(enum_obj, "value"):
            return str(enum_obj.value)
        else:
            return str(enum_obj) if enum_obj is not None else default_value

    def _extract_data_type(self, artifact_data) -> str:
        """Extract the actual data type (str, DataFrame, etc.) from artifact data"""
        try:
            if hasattr(artifact_data, "data_type") and artifact_data.data_type:
                data_type_obj = artifact_data.data_type
                if hasattr(data_type_obj, "attribute") and data_type_obj.attribute:
                    return str(data_type_obj.attribute)
            return "unknown"
        except (AttributeError, TypeError):
            return "unknown"

    def build_nodes_from_steps(self) -> None:
        """Builds internal node list from run steps"""
        self.nodes = []
        self.artifacts = {}

        # Try to get steps from different locations based on response format
        steps_data = None

        # Option 1: Steps in run.steps (new format)
        if hasattr(self.run, "steps") and self.run.steps:
            steps_data = self.run.steps
        # Option 2: Steps in run.metadata.steps (old format)
        elif (
            hasattr(self.run, "metadata")
            and hasattr(self.run.metadata, "steps")
            and self.run.metadata.steps
        ):
            steps_data = self.run.metadata.steps
        else:
            # No steps available
            return

        for step_name, step_data in steps_data.items():
            # Extract timing data if available
            start_time = getattr(step_data, "start_time", None)
            end_time = getattr(step_data, "end_time", None)

            step_node_data = {
                "execution_id": str(step_data.id),
                "name": step_name,
                "status": self._extract_enum_value(step_data.status, "unknown"),
            }

            # Add timing data if available
            if start_time:
                step_node_data["start_time"] = str(start_time)
            if end_time:
                step_node_data["end_time"] = str(end_time)

            self.nodes.append(
                {
                    "id": str(step_data.id),
                    "type": "step",
                    "data": step_node_data,
                }
            )
            # Only add artifacts if step data has inputs/outputs
            if hasattr(step_data, "inputs") and step_data.inputs:
                self.add_artifacts_from_list(step_data.inputs)
            if hasattr(step_data, "outputs") and step_data.outputs:
                self.add_artifacts_from_list(step_data.outputs)

    def add_artifacts_from_list(self, dictOfArtifacts: Dict[str, StepArtifact]) -> None:
        """Used to add unique artifacts to the internal nodes list by build_nodes_from_steps"""
        for artifact_name, artifact_value in dictOfArtifacts.items():
            try:
                if isinstance(artifact_value, list):
                    if not artifact_value:
                        continue

                    artifact_version = artifact_value[0]
                    if hasattr(artifact_version, "artifact") and hasattr(
                        artifact_version.artifact, "id"
                    ):
                        artifact_id = str(artifact_version.artifact.id)
                    elif hasattr(artifact_version, "id"):
                        artifact_id = str(artifact_version.id)
                    else:
                        continue

                    artifact_data = artifact_version
                    # Handle enum artifact_type properly
                    raw_artifact_type = getattr(artifact_data, "type", "Unknown")
                    artifact_type = self._extract_enum_value(raw_artifact_type, "Unknown")
                    # Extract the actual data type (str, DataFrame, etc.)
                    data_type = self._extract_data_type(artifact_data)
                    execution_id = str(getattr(artifact_data, "id", "Unknown"))
                else:
                    if hasattr(artifact_value, "artifact") and hasattr(
                        artifact_value.artifact, "id"
                    ):
                        artifact_id = str(artifact_value.artifact.id)
                        raw_artifact_type = getattr(artifact_value, "type", "Unknown")
                        artifact_type = self._extract_enum_value(raw_artifact_type, "Unknown")
                        # Extract the actual data type (str, DataFrame, etc.)
                        data_type = self._extract_data_type(artifact_value)
                        execution_id = str(getattr(artifact_value, "id", "Unknown"))
                    else:
                        artifact_id = str(artifact_value.id)
                        raw_artifact_type = getattr(artifact_value, "type", "Unknown")
                        artifact_type = self._extract_enum_value(raw_artifact_type, "Unknown")
                        # Extract the actual data type (str, DataFrame, etc.)
                        data_type = self._extract_data_type(artifact_value)
                        execution_id = str(artifact_value.id)
            except (AttributeError, TypeError):
                continue

            if artifact_id in self.artifacts:
                continue

            self.artifacts[artifact_id] = True

            self.nodes.append(
                {
                    "type": "artifact",
                    "full_data": artifact_value,
                    "id": artifact_id,
                    "data": {
                        "name": artifact_name,
                        "artifact_type": artifact_type,  # DataArtifact, ModelArtifact, etc.
                        "type": data_type,  # str, DataFrame, HTMLString, etc.
                        "execution_id": execution_id,
                    },
                }
            )

    def build_edges_from_steps(self) -> None:
        """Builds internal edges list from run steps"""
        self.edges = []

        # Try to get steps from different locations based on response format
        steps_data = None

        # Option 1: Steps in run.steps (new format)
        if hasattr(self.run, "steps") and self.run.steps:
            steps_data = self.run.steps
        # Option 2: Steps in run.metadata.steps (old format)
        elif (
            hasattr(self.run, "metadata")
            and hasattr(self.run.metadata, "steps")
            and self.run.metadata.steps
        ):
            steps_data = self.run.metadata.steps
        else:
            # No steps available
            return

        for step_name, step_data in steps_data.items():  # noqa: B007
            step_id = str(step_data.id)

            # Process inputs
            if hasattr(step_data, "inputs") and step_data.inputs:
                for artifact in step_data.inputs:
                    try:
                        if isinstance(step_data.inputs[artifact], list):
                            if not step_data.inputs[artifact]:  # Skip empty lists
                                continue
                            artifact_version = step_data.inputs[artifact][0]
                            if hasattr(artifact_version, "artifact") and hasattr(
                                artifact_version.artifact, "id"
                            ):
                                input_id = str(artifact_version.artifact.id)
                            elif hasattr(artifact_version, "id"):
                                input_id = str(artifact_version.id)
                            else:
                                continue
                        else:
                            # Older access pattern
                            input_id = str(step_data.inputs[artifact].artifact.id)

                        self.add_edge(input_id, step_id)
                    except (AttributeError, TypeError):
                        continue

            # Process outputs
            if hasattr(step_data, "outputs") and step_data.outputs:
                for artifact in step_data.outputs:
                    try:
                        if isinstance(step_data.outputs[artifact], list):
                            if not step_data.outputs[artifact]:
                                continue
                            artifact_version = step_data.outputs[artifact][0]
                            if hasattr(artifact_version, "artifact") and hasattr(
                                artifact_version.artifact, "id"
                            ):
                                output_id = str(artifact_version.artifact.id)
                            elif hasattr(artifact_version, "id"):
                                output_id = str(artifact_version.id)
                            else:
                                continue
                        else:
                            # Older access pattern
                            output_id = str(step_data.outputs[artifact].artifact.id)

                        self.add_edge(step_id, output_id)
                    except (AttributeError, TypeError):
                        continue

    def add_edge(self, v: str, w: str) -> None:
        """Helper method to add an edge to the internal edges list"""
        self.edges.append(
            {
                "id": f"{v}_{w}",
                "source": v,
                "target": w,
            }
        )

    def to_dict(self) -> GraphResponse:
        """Returns dictionary containing graph data"""
        # Use explicit overrides if provided, otherwise use helper functions
        raw_status = self._run_status if self._run_status is not None else _get_run_status(self.run)
        # Convert enum to string if needed
        status = self._extract_enum_value(raw_status, "unknown") if raw_status else "unknown"
        name = self._run_name if self._run_name is not None else _get_run_pipeline_name(self.run)

        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "status": status,
            "name": name if name else "unknown",
        }
