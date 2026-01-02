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
    if hasattr(run, 'body') and run.body is not None:
        status = getattr(run.body, 'status', None)
        if status is not None:
            return status
    return getattr(run, 'status', None)


def _get_run_pipeline_name(run) -> Optional[str]:
    """Get the pipeline name from a run, handling model structure changes."""
    # Try new location first (0.93.0+): run.resources.pipeline.name
    if hasattr(run, 'resources') and run.resources is not None:
        pipeline = getattr(run.resources, 'pipeline', None)
        if pipeline is not None and hasattr(pipeline, 'name'):
            return pipeline.name
    
    # Try old location: run.body.pipeline.name
    if hasattr(run, 'body') and run.body is not None:
        pipeline = getattr(run.body, 'pipeline', None)
        if pipeline is not None and hasattr(pipeline, 'name'):
            return pipeline.name
    
    # Final fallback: use the run's own name
    return getattr(run, 'name', None)


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

    def build_nodes_from_steps(self) -> None:
        """Builds internal node list from run steps"""
        self.nodes = []
        self.artifacts = {}

        for step in self.run.metadata.steps:
            step_data = self.run.metadata.steps[step]
            self.nodes.append({
                "id": str(step_data.id),
                "type": "step",
                "data": {
                    "execution_id": str(step_data.id),
                    "name": step,
                    "status": step_data.body.status,
                },
            })
            self.add_artifacts_from_list(step_data.body.inputs)
            self.add_artifacts_from_list(step_data.body.outputs)


    def add_artifacts_from_list(self, dictOfArtifacts: Dict[str, StepArtifact]) -> None:
        """Used to add unique artifacts to the internal nodes list by build_nodes_from_steps"""
        for artifact in dictOfArtifacts:
            id = str(dictOfArtifacts[artifact].body.artifact.id)
            if id in self.artifacts:
                continue

            self.artifacts[id] = True

            self.nodes.append({
                "type": "artifact",
                "id": id,
                "data": {
                    "name": artifact,
                    "artifact_type": dictOfArtifacts[artifact].body.type,
                    "execution_id": str(dictOfArtifacts[artifact].id),
                },
            })


    def build_edges_from_steps(self) -> None:
        """Builds internal edges list from run steps"""
        self.edges = []

        for step in self.run.metadata.steps:
            step_data = self.run.metadata.steps[step]
            step_id = str(step_data.id)

            for artifact in step_data.body.inputs:
                input_id = str(step_data.body.inputs[artifact].body.artifact.id)
                self.add_edge(input_id, step_id)

            for artifact in step_data.body.outputs:
                output_id = str(step_data.body.outputs[artifact].body.artifact.id)
                self.add_edge(step_id, output_id)


    def add_edge(self, v: str, w: str) -> None:
        """Helper method to add an edge to the internal edges list"""
        self.edges.append({
            "id": f"{v}_{w}",
            "source": v,
            "target": w,
        })
        
    def to_dict(self) -> GraphResponse:
        """Returns dictionary containing graph data"""
        # Use explicit overrides if provided, otherwise use helper functions
        status = self._run_status if self._run_status is not None else _get_run_status(self.run)
        name = self._run_name if self._run_name is not None else _get_run_pipeline_name(self.run)
        
        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "status": status,
            "name": name,
        }