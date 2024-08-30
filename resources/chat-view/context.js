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
const treeData = [
  {name: 'Server'},
  {name: 'Environment'},
  {
    name: 'Pipeline',
    children : [
      {
        name: 'training',
        children: [
          {name: 'id: 85439137'},
          {name: 'completed: success'}
        ]
      }
    ]
  },
  {name: 'Stack'},
  {name: 'Stack Components'}
];

function createTreeView(items, parentEl, level = 0) {
  items.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'tree-item';
    itemEl.style.paddingLeft = `${level * 12}px`;

    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'tree-item-wrapper';

    const contentEl = document.createElement('div');
    contentEl.className = 'tree-item-content';

    const checkboxEl = document.createElement('input');
    checkboxEl.type = 'checkbox';
    checkboxEl.className = 'tree-item-checkbox';

    const chevronEl = document.createElement('span');
    chevronEl.className = 'tree-item-icon';
    
    const isFolder = item.children && item.children.length > 0;
    
    chevronEl.innerHTML = isFolder
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" fill="none" stroke="none"/></svg>';

    const nameEl = document.createElement('span');
    nameEl.className = 'tree-item-name';
    nameEl.textContent = item.name;

    if (level < 2) {
      contentEl.appendChild(checkboxEl);
    }
    contentEl.appendChild(chevronEl);
    contentEl.appendChild(nameEl);
    wrapperEl.appendChild(contentEl);

    if (isFolder) {
      const childrenEl = document.createElement('div');
      childrenEl.className = 'tree-item-children';
      createTreeView(item.children, childrenEl, level + 1);

      contentEl.addEventListener('click', (e) => {
        if (e.target !== checkboxEl && !childrenEl.contains(e.target)) {
          e.stopPropagation();
          childrenEl.classList.toggle('open');
          if (childrenEl.classList.contains('open')) {
              chevronEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
          } else {
              chevronEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
          }
        }
      });

      wrapperEl.appendChild(childrenEl);
    }

    checkboxEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    checkboxEl.addEventListener('change', (e) => {
      if (e.target.checked) {
        itemEl.style.backgroundColor = '#2a2d2e';
      } else {
        itemEl.style.backgroundColor = '';
      }
    });

    itemEl.appendChild(wrapperEl);
    parentEl.appendChild(itemEl);
  });
}

const treeViewEl = document.getElementById('tree-view');
createTreeView(treeData, treeViewEl);