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

  // Function to send the message
  function sendMessage(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const text = formData.get('messageInput').trim();
    const checkedBoxes = document.querySelectorAll('#tree-view input[type="checkbox"]:checked');
    const checkedValues = Array.from(checkedBoxes).map(checkbox => checkbox.value);
    // const sampleQuestions = document.querySelector('#sampleQuestions')

    if (text) {
      vscode.postMessage({
        command: 'sendMessage',
        text: text,
        context: checkedValues,
      });

      event.target.reset();
      // sampleQuestions.classList.remove('flex')
      // sampleQuestions.classList.add('hide')
    }
  }

  document.getElementById('chatForm').addEventListener('submit', sendMessage);

  // Clears Chat Log
  function clearChatLog() {
    vscode.postMessage({
      command: 'clearChat',
    });
  }

  document.getElementById('clearChat').addEventListener('click', clearChatLog);
})();
