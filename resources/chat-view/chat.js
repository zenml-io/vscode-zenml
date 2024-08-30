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
    const context = [];

    context.push(formData.get('serverContext'));
    context.push(formData.get('environmentContext'));
    context.push(formData.get('pipelineContext'));
    context.push(formData.get('stackContext'));
    context.push(formData.get('stackComponentsContext'));
    context.push(formData.get('recentPipelineContext'));

    if (text) {
      vscode.postMessage({
        command: 'sendMessage',
        text: text,
        context: context,
      });

      event.target.reset();

      const messagesDiv = document.getElementById('messages');
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.innerHTML = `<p>${text}<p>`;
      messagesDiv.appendChild(messageDiv);
    }
  }

  document.getElementById('chatForm').addEventListener('submit', sendMessage);
})();
