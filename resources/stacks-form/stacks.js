document.querySelector('input[name="orchestrator"]').toggleAttribute('required');
document.querySelector('input[name="artifact_store"]').toggleAttribute('required');

const form = document.querySelector('form');
const submit = document.querySelector('input[type="submit"]');
const spinner = document.querySelector('.loader');
let previousValues = {};
let id = undefined;
let mode = 'create';

form.addEventListener('click', evt => {
  const target = evt.target;

  let input = null;
  if (target instanceof HTMLLabelElement) {
    input = document.getElementById(target.htmlFor);
  }

  if (target instanceof HTMLInputElement && target.type === 'radio') {
    input = target;
  }
  if (!input) {
    return;
  }

  const value = input.value;
  const name = input.name;
  if (previousValues[name] === value) {
    delete previousValues[name];
    input.checked = false;
  } else {
    previousValues[name] = value;
  }
});

(() => {
  const vscode = acquireVsCodeApi();

  form.addEventListener('submit', evt => {
    evt.preventDefault();
    submit.disabled = true;
    spinner.classList.remove('hidden');
    const data = Object.fromEntries(new FormData(evt.target));

    if (id) {
      data.id = id;
    }

    vscode.postMessage({
      command: mode,
      data,
    });
  });
})();

const title = document.querySelector('h2');
const nameInput = document.querySelector('input[name="name"]');

window.addEventListener('message', evt => {
  const message = evt.data;

  switch (message.command) {
    case 'create':
      mode = 'create';
      title.innerText = 'Create Stack';
      id = undefined;
      previousValues = {};
      form.reset();
      break;

    case 'update':
      mode = 'update';
      title.innerText = 'Update Stack';
      id = message.data.id;
      nameInput.value = message.data.name;
      previousValues = message.data.components;
      Object.entries(message.data.components).forEach(([type, id]) => {
        const input = document.querySelector(`[name="${type}"][value="${id}"]`);
        input.checked = true;
      });
      break;

    case 'fail':
      spinner.classList.add('hidden');
      submit.disabled = false;
      break;
  }
});
