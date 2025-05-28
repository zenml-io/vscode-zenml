// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing
// permissions and limitations under the License.

import { ArrayXY, SVG, registerWindow } from '@svgdotjs/svg.js';
import * as Dagre from 'dagre';
import { DagNode } from '../../types/PipelineTypes';
import { DagConfig } from '../DagConfig';
import { StatusUtils } from '../utils/StatusUtils';

export class SvgRenderer {
  private createSVGWindow: () => any = () => ({});
  private iconSvgs: { [name: string]: string };
  private config: DagConfig;

  constructor(createSVGWindow: () => any, iconSvgs: { [name: string]: string }, config: DagConfig) {
    this.createSVGWindow = createSVGWindow;
    this.iconSvgs = iconSvgs;
    this.config = config;
  }

  /**
   * Calculates edge paths for the DAG layout
   */
  private calculateEdges(graph: Dagre.graphlib.Graph): Array<{ from: string; points: ArrayXY[] }> {
    const edges = graph.edges();
    return edges.map(edge => {
      const currentLine = graph.edge(edge).points.map<ArrayXY>(point => [point.x, point.y]);
      const startNode = graph.node(edge.v);
      const endNode = graph.node(edge.w);

      const rest = currentLine.slice(1, currentLine.length - 1);
      const start = [startNode.x, startNode.y + startNode.height / 2];
      const end = [endNode.x, endNode.y - endNode.height / 2];
      const second = [startNode.x, rest[0][1]];
      const penultimate = [endNode.x, rest[rest.length - 1][1]];

      return {
        from: edge.v,
        points: [start, second, ...rest, penultimate, end] as ArrayXY[],
      };
    });
  }

  /**
   * Creates a step node with vertical layout
   */
  private createStepNode(
    node: DagNode & ReturnType<typeof Dagre.graphlib.Graph.prototype.node>,
    nodeContent: any,
    status: string
  ): void {
    const nodeMain = nodeContent.element('div').attr('class', 'node-main');

    // Add icon first
    const iconSVG = StatusUtils.getStepIcon(status, this.iconSvgs);
    if (iconSVG) {
      const icon = SVG(iconSVG);
      nodeMain.add(SVG(icon).attr('class', `icon ${status}`));
    }

    // Add text after icon
    nodeMain.element('p').words(node.data.name);

    // Add duration below
    const duration = StatusUtils.extractDuration(node.data);
    if (duration) {
      nodeContent.element('div').attr('class', 'node-secondary duration').words(duration);
    }
  }

  /**
   * Creates an artifact node with horizontal layout
   */
  private createArtifactNode(
    node: DagNode & ReturnType<typeof Dagre.graphlib.Graph.prototype.node>,
    nodeContent: any
  ): void {
    // Add icon
    const iconSVG = StatusUtils.getArtifactIcon(node.data.artifact_type || '', this.iconSvgs);
    if (iconSVG) {
      const icon = SVG(iconSVG);
      nodeContent.add(SVG(icon).attr('class', 'icon'));
    }

    // Create text content container with vertical layout
    const textContent = nodeContent.element('div').attr('class', 'node-text-content');

    // Add name
    const nodeMain = textContent.element('div').attr('class', 'node-main');
    nodeMain.element('p').words(node.data.name);

    // Add data type below name
    const dataType = node.data.type || 'unknown';
    textContent.element('div').attr('class', 'node-secondary data-type').words(dataType);
  }

  /**
   * Renders the complete DAG as SVG
   */
  async drawDag(graph: Dagre.graphlib.Graph): Promise<string> {
    const window = this.createSVGWindow();
    const document = window.document;

    registerWindow(window, document);
    const canvas = SVG().addTo(document.documentElement).id('dag');
    canvas.size(graph.graph().width, graph.graph().height);
    const orthoEdges = this.calculateEdges(graph);

    // Create edges
    const edgeGroup = canvas.group().attr('id', 'edges');
    orthoEdges.forEach(edge => {
      edgeGroup
        .polyline(edge.points)
        .fill('none')
        .stroke({ width: 2, linecap: 'round', linejoin: 'round' })
        .attr('data-from', edge.from);
    });

    // Create nodes
    const nodeGroup = canvas.group().attr('id', 'nodes');
    graph.nodes().forEach(nodeId => {
      const node = graph.node(nodeId) as DagNode & ReturnType<typeof graph.node>;
      const status =
        node.type === 'step' ? StatusUtils.normalizeStatus((node.data as any).status) : '';
      const executionId = { attr: '', value: node.data.execution_id };

      if (node.type === 'step') {
        executionId.attr = 'data-stepid';
      } else {
        executionId.attr = 'data-artifactid';
      }

      const container = nodeGroup
        .foreignObject(node.width, node.height)
        .translate(node.x - node.width / 2, node.y - node.height / 2);

      const div = container
        .element('div')
        .attr('class', 'node')
        .attr('data-id', node.id)
        .attr(executionId.attr, executionId.value); // Add data attributes here

      const box = div
        .element('div')
        .attr('class', `${node.type} ${status}`)
        .attr('data-node-id', node.id); // Needed for selection styling

      const nodeContent = box.element('div').attr('class', 'node-content');

      if (node.type === 'step') {
        this.createStepNode(node, nodeContent, status);
      } else {
        this.createArtifactNode(node, nodeContent);
      }
    });

    return canvas.svg();
  }
}
