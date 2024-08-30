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
