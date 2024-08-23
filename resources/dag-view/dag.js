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
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
import svgPanZoom from 'svg-pan-zoom';

(() => {
  const dag = document.querySelector('#dag');
  let contextMenu = null;
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
    closeContextMenu();

    const stepId = evt.target.closest('[data-stepid]')?.dataset.stepid;
    const artifactId = evt.target.closest('[data-artifactid]')?.dataset.artifactid;

    if (!stepId && !artifactId) {
      return;
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

  dag.addEventListener('contextmenu', evt => {
    closeContextMenu();
    evt.preventDefault();

    const step = evt.target.closest('[data-stepid]');
    const artifact = evt.target.closest('[data-artifactid]');

    if (!step && !artifact) {
      return;
    }

    openContextMenu(step ? 'step' : 'artifact', step || artifact, evt.pageX, evt.pageY);
  });

  window.addEventListener('message', evt => {
    console.log(evt.data);
    if (evt.data === 'AI Query Complete') closeContextMenu();
  });

  function openContextMenu(command, component, x, y) {
    const id = component.dataset.id;

    const CONTEXT_MENU_HTML = `
      <div id="context-menu">
        <ul>
          <li id="inspect">Inspect</li>
          <li id="open-dashboard-url">Open Dashboard URL</li>
          ${
            command === 'step' && component.querySelector('svg.failed')
              ? `<li id="suggest-fix">Suggest Fix</li>`
              : ''
          }
        </ul>
      </div>`;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = CONTEXT_MENU_HTML.trim();
    contextMenu = tempDiv.firstChild;

    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;

    contextMenu.querySelector('#inspect').addEventListener('click', () => {
      vscode.postMessage({ command, id });
    });
    contextMenu.querySelector('#open-dashboard-url').addEventListener('click', () => {
      vscode.postMessage({ command: `${command}Url`, id });
    });
    contextMenu.querySelector('#suggest-fix')?.addEventListener('click', () => {
      contextMenu.querySelector('#suggest-fix').textContent = 'Loading...';
      vscode.postMessage({ command: `stepFix`, id });
    });
    contextMenu.addEventListener('click', evt => {
      if (evt.target.id !== 'suggest-fix') closeContextMenu();
    });

    document.body.insertBefore(contextMenu, document.body.firstChild);
  }

  function closeContextMenu() {
    contextMenu?.remove();
    contextMenu = null;
  }

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
