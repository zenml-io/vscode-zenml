// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
(function () {
  const vscode = acquireVsCodeApi();

  // Function to save the current state
  function saveState() {
    const model = document.querySelector('.model-dropdown').value;
    const checkedBoxes = Array.from(
      document.querySelectorAll('#tree-view input[type="checkbox"]:checked')
    ).map(checkbox => checkbox.value);

    localStorage.setItem('selectedModel', model);
    localStorage.setItem('checkedContexts', JSON.stringify(checkedBoxes));
  }

  // Function to restore the saved state
  function restoreState() {
    const selectedModel = localStorage.getItem('selectedModel');
    const checkedContexts = JSON.parse(localStorage.getItem('checkedContexts')) || [];

    if (selectedModel) {
      document.querySelector('.model-dropdown').value = selectedModel;
    }

    checkedContexts.forEach(value => {
      const checkbox = document.querySelector(
        `#tree-view input[type="checkbox"][value="${value}"]`
      );
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }

  // Function to send the message
  function sendMessage(event) {
    event.preventDefault();
    if (isInputDisabled) {
      return;
    }

    const formData = new FormData(event.target);
    const text = formData.get('messageInput');
    const checkedBoxes = document.querySelectorAll('#tree-view input[type="checkbox"]:checked');
    const model = document.querySelector('.model-dropdown').value;
    let checkedValues = Array.from(checkedBoxes).map(checkbox => checkbox.value);
    checkedValues.unshift(model);

    if (text) {
      vscode.postMessage({
        command: 'sendMessage',
        text: text,
        context: checkedValues,
      });

      event.target.reset();
      saveState(); // Save state before refresh
    }
  }

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'updateChatLog':
        document.getElementById('chatMessages').innerHTML = message.chatLogHtml;
        break;
    }
  });

  document.getElementById('chatForm').addEventListener('submit', sendMessage);

  // Clears chat log
  function clearChatLog() {
    vscode.postMessage({
      command: 'clearChat',
    });
    saveState(); // Save state before refresh
  }

  document.getElementById('clearChat').addEventListener('click', clearChatLog);

  function appendToChat(text, role) {
    const chatMessages = document.getElementById('chatMessages');
    let messageDiv;

    if (role === 'assistant') {
      messageDiv =
        chatMessages.querySelector('div[data-role="assistant"]:last-child') ||
        chatMessages.lastElementChild;

      if (!messageDiv || messageDiv.getAttribute('data-role') !== 'assistant') {
        messageDiv = document.createElement('div');
        messageDiv.className = 'p-4 assistant';
        messageDiv.setAttribute('data-role', 'assistant');
        messageDiv.innerHTML = `
          <p class="font-semibold text-zenml">ZenML Assistant</p>
        `;

        chatMessages.appendChild(messageDiv, chatMessages.firstChild);
        currentAssistantMessage = '';
      }

      currentAssistantMessage += text;

      requestAnimationFrame(() => {
        messageDiv.innerHTML = `
          <p class="font-semibold text-zenml">ZenML Assistant</p>
          ${marked.parse(currentAssistantMessage)}
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }
  }

  let isInputDisabled = false;

  function disableInput() {
    isInputDisabled = true;
    document.getElementById('sendMessage').disabled = true;
  }

  function enableInput() {
    isInputDisabled = false;
    document.getElementById('sendMessage').disabled = false;
  }

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'updateChatLog':
        document.getElementById('chatMessages').innerHTML = message.chatLogHtml;
        addCopyButtonsToAssistantMessages(); // For the potential view refresh command
        break;
      case 'receiveMessage': {
        if (message.text === 'disableInput') {
          disableInput();
        } else if (message.text === 'enableInput') {
          enableInput();
          addCopyButtonToLastAssistantMessage();
        } else {
          appendToChat(message.text, 'assistant');
        }
      }
      case 'showInfo':
        vscode.window.showInformationMesage(message.text);
    }
  });

  function addCopyButtonsToAssistantMessages() {
    const assistantMessages = document.querySelectorAll('.assistant');
    assistantMessages.forEach(addCopyButtonToMessage);
  }
  
  function addCopyButtonToLastAssistantMessage() {
    const lastAssistantMessage = document.querySelector('.assistant:last-child');
    if (lastAssistantMessage) {
      addCopyButtonToMessage(lastAssistantMessage);
    }
  }
  
  function addCopyButtonToMessage(messageDiv) {
    if (!messageDiv.querySelector('.copy-button')) {
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.textContent = 'Copy';
      copyButton.addEventListener('click', () => {
        // Find all text content within the message div, excluding the "ZenML Assistant" header and the copy button
        const content = Array.from(messageDiv.childNodes)
          .filter(node =>
            node.nodeType === Node.TEXT_NODE ||
            (node.nodeType === Node.ELEMENT_NODE &&
              !node.classList.contains('font-semibold')) &&
              !node.classList.contains('copy-button'))
          .map(node => node.textContent)
          .join('')
          .trim();
  
        if (content) {
          navigator.clipboard.writeText(content).then(() => {
            vscode.postMessage({ command: 'showInfo', text: 'Message copied to clipboard' });
          });
        } else {
          vscode.postMessage({ command: 'showInfo', text: 'No content to copy' });
        }
      });
      messageDiv.appendChild(copyButton);
    }
  }

  // Add event listeners to save state when dropdown or checkboxes change
  document.querySelector('.model-dropdown').addEventListener('change', saveState);
  document.querySelectorAll('#tree-view input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', saveState);
  });

  // Restore state when page loads
  document.addEventListener('DOMContentLoaded', restoreState);

  // Send a pre-determined message when the button is clicked
  function sendSampleMessage() {
    const model = document.querySelector('.model-dropdown').value;
    let context = [model];
    let buttonValue = this.value;
    let message;

    switch (buttonValue) {
      case 'aboutChat':
        message = 'What can this chat do?';
        break;
      case 'improveStack':
        message = 'Help me improve my stack.';
        context.push('stackContext');
        context.push('stackComponentsContext');
        break;
      case 'summarizeStats':
        message = 'Generate a summary of my stats.';
        context.push('serverContext');
        context.push('environmentContext');
        context.push('pipelineContext');
        context.push('stackContext');
        context.push('stackComponentsContext');
        break;
      case 'summarizeLogs':
        message = 'Generate a summary of my logs.';
        context.push('logsContext');
      default:
        break;
    }

    vscode.postMessage({
      command: 'sendMessage',
      text: message,
      context: context,
    });

    saveState();
  }

  document.querySelectorAll('.sampleQuestions').forEach(button => {
    button.addEventListener('click', sendSampleMessage);
  });

  const expandElement = document.querySelector('.expand');

  function expandList(event) {
    event.preventDefault();
    event.stopPropagation();
    const hiddenElements = expandElement.parentElement.querySelectorAll('.hidden');
    hiddenElements.forEach(element => {
      element.classList.remove('hidden');
    });
    expandElement.remove();
  }

  expandElement.addEventListener('click', expandList);
})();
