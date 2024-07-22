const form = document.querySelector('form');
const submit = document.querySelector('input[type="submit"]');
const spinner = document.querySelector('.loader');

let mode = 'create';
let type = '';
let flavor = '';
let id = '';

const inputs = {};
document.querySelectorAll('.field > input, textarea').forEach(element => {
  inputs[element.id] = element;
  if (element instanceof HTMLTextAreaElement) {
    element.addEventListener('input', evt => {
      try {
        JSON.parse(evt.target.value);
      } catch {
        element.setCustomValidity('Invalid JSON value');
        element.reportValidity();
        return;
      }
      element.setCustomValidity('');
    });
  }
});

form.addEventListener('click', evt => {
  const target = evt.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  evt.preventDefault();

  const current = target.textContent;
  target.textContent = current === '+' ? '-' : '+';
  const fieldName = target.dataset.id;
  const field = document.getElementById(fieldName);
  field.classList.toggle('hidden');
});

(() => {
  const vscode = acquireVsCodeApi();

  form.addEventListener('submit', evt => {
    evt.preventDefault();

    const data = Object.fromEntries(new FormData(form));

    for (const id in inputs) {
      if (inputs[id].classList.contains('hidden')) {
        delete data[id];
        continue;
      }

      if (inputs[id] instanceof HTMLTextAreaElement) {
        data[id] = inputs[id].textContent;
      }
    }

    data.flavor = flavor;
    data.type = type;

    submit.disabled = true;
    spinner.classList.remove('hidden');
    vscode.postMessage({
      command: mode,
      data,
    });
  });
})();

window.addEventListener('message', evt => {
  const message = evt.data;

  switch (message.command) {
    case 'create':
      mode = 'create';
      type = message.type;
      flavor = message.flavor;
      id = '';
      break;

    case 'update':
      mode = 'update';
      type = message.type;
      flavor = message.flavor;
      id = message.id;
      // TODO: set fields to data values
      break;

    case 'fail':
      spinner.classList.add('hidden');
      submit.disabled = false;
      break;
  }
});
