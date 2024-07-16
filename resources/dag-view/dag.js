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
