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
const form = document.querySelector('form');
const submit = document.querySelector('input[type="submit"]');
const spinner = document.querySelector('.loader');

let mode = 'create';
let type = '';
let flavor = '';
let id = '';

const inputs = {};

document.querySelectorAll('.input').forEach(element => {
  inputs[element.id] = element;
  if (element instanceof HTMLTextAreaElement) {
    element.addEventListener('input', evt => {
      try {
        const val = JSON.parse(evt.target.value);
        if (evt.target.dataset.array && !Array.isArray(val)) {
          element.setCustomValidity('Must be an array');
          element.reportValidity();
          return;
        }
      } catch {
        element.setCustomValidity('Invalid JSON value');
        element.reportValidity();
        return;
      }
      element.setCustomValidity('');
    });
  }
});

const setValues = (name, config) => {
  document.querySelector('[name="name"]').value = name;

  for (const key in config) {
    if (
      config[key] === null ||
      !inputs[key] ||
      (inputs[key].classList.contains('hidden') && !config[key])
    ) {
      continue;
    }

    if (typeof config[key] === 'boolean' && config[key]) {
      inputs[config].checked = 'on';
    }

    if (typeof config[key] === 'object') {
      inputs[key].value = JSON.stringify(config[key]);
    } else {
      inputs[key].value = String(config[key]);
    }

    if (inputs[key].classList.contains('hidden')) {
      inputs[key].classList.toggle('hidden');
      button = document.querySelector(`[data-id="${inputs[key].id}"]`);
      button.textContent = '-';
    }
  }
};

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
        data[id] = null;
        continue;
      }

      if (inputs[id] instanceof HTMLTextAreaElement) {
        data[id] = JSON.parse(inputs[id].value);
      }

      if (inputs[id].type === 'checkbox') {
        data[id] = !!inputs[id].checked;
      }

      if (inputs[id].type === 'number') {
        data[id] = Number(inputs[id].value);
      }
    }

    data.flavor = flavor;
    data.type = type;

    submit.disabled = true;
    spinner.classList.remove('hidden');

    if (mode === 'update') {
      data.id = id;
    }

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
      setValues(message.name, message.config);
      break;

    case 'fail':
      spinner.classList.add('hidden');
      submit.disabled = false;
      break;
  }
});
