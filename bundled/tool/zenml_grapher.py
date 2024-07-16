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

from typing import Dict, List
from type_hints import GraphEdge, GraphNode, GraphResponse, StepArtifact

class Grapher:
    """Quick and dirty implementation of ZenML/LineageGraph to reduce number of api calls"""

    def __init__(self, run):
        self.run = run
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
        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "status": self.run.body.status,
            "name": self.run.body.pipeline.name,
            "version": self.run.body.pipeline.body.version,
        }