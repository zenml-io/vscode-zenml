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

/* eslint-env browser */
/* global acquireVsCodeApi, document, window, setTimeout */

import svgPanZoom from 'svg-pan-zoom';

(() => {
  const dag = document.querySelector('#dag');
  const panZoom = svgPanZoom(dag);
  panZoom.enableControlIcons();
  panZoom.setMaxZoom(40);

  const vscode = acquireVsCodeApi();

  const resize = () => {
    dag.setAttribute('width', String(window.innerWidth * 0.95) + 'px');
    dag.setAttribute('height', String(window.innerHeight * 0.95) + 'px');
    panZoom.resize();
    panZoom.fit();
    panZoom.center();
  };

  resize();
  window.addEventListener('resize', resize);

  // Handle retry button clicks for error/no-steps views
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      vscode.postMessage({ command: 'update' });
    });
  }

  const edges = [...document.querySelectorAll('polyline')];

  dag.addEventListener('mouseover', evt => {
    let target = evt.target;
    const parent = evt.target.closest('.node');

    if (!parent || target === parent) {
      return;
    }

    if (target.tag !== 'div') {
      target = target.closest('div');
    }

    const id = parent.dataset.id;
    const edgesToHighlight = edges.filter(edge => edge.dataset.from === id);
    target.classList.add('highlight');
    edgesToHighlight.forEach(edge => edge.classList.add('highlight'));
  });

  dag.addEventListener('click', evt => {
    const stepElement = evt.target.closest('[data-stepid]');
    const artifactElement = evt.target.closest('[data-artifactid]');
    const rawNode = stepElement || artifactElement;
    if (!rawNode) {
      return;
    }

    const stepId = rawNode.dataset.stepid;
    const artifactId = rawNode.dataset.artifactid;

    // Remove any existing selection
    document
      .querySelectorAll('.node > .step.selected, .node > .artifact.selected')
      .forEach(el => el.classList.remove('selected'));

    // Find the inner div that  has the .step or .artifact border
    const styledDiv = rawNode
      .closest('.node') // get back to the .node container
      .querySelector(':scope > .step, :scope > .artifact');

    if (styledDiv) {
      styledDiv.classList.add('selected');
    }

    if (!panZoom.isDblClickZoomEnabled()) {
      // double click
      if (stepId) {
        vscode.postMessage({ command: 'stepUrl', id: stepId });
      }

      if (artifactId) {
        vscode.postMessage({ command: 'artifactUrl', id: artifactId });
      }
      return;
    }

    panZoom.disableDblClickZoom();
    setTimeout(() => panZoom.enableDblClickZoom(), 500);

    if (stepId) {
      vscode.postMessage({ command: 'step', id: stepId });
    }

    if (artifactId) {
      vscode.postMessage({ command: 'artifact', id: artifactId });
    }
  });

  const nodes = [...document.querySelectorAll('.node > div')];

  nodes.forEach(node => {
    const id = node.parentElement.dataset.id;

    node.addEventListener('mouseleave', () => {
      const edgesToHighlight = edges.filter(edge => edge.dataset.from === id);
      node.classList.remove('highlight');
      edgesToHighlight.forEach(edge => edge.classList.remove('highlight'));
    });
  });

  function update() {
    vscode.postMessage({ command: 'update' });
  }

  const button = document.querySelector('#update button');
  button?.addEventListener('click', update);
})();
