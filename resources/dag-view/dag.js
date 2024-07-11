const dag = document.querySelector('#dag');
const panZoom = svgPanZoom(dag);
panZoom.enableControlIcons();
panZoom.setMaxZoom(40);

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
  const target = evt.target;
  const parent = evt.target.parentElement;

  if (!parent.classList.contains('node')) {
    return;
  }

  const id = parent.dataset.id;
  const edgesToHighlight = edges.filter(edge => edge.dataset.from === id);
  target.classList.add('highlight');
  edgesToHighlight.forEach(edge => edge.classList.add('highlight'));
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

const vscode = acquireVsCodeApi();
function update() {
  vscode.postMessage({ command: 'update' });
}

const button = document.querySelector('#update button');
button?.addEventListener('click', update);
