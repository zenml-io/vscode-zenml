(function() {
    const vscode = acquireVsCodeApi();
  
    // Event listener for the send button
    document.getElementById('sendMessage').addEventListener('click', () => {
      const input = document.getElementById('messageInput');
      const message = input.value.trim();
  
      // Ensure there's a message before sending
      if (message) {
        // Post the message to the VSCode extension
        vscode.postMessage({
          command: 'sendMessage',
          text: message
        });
  
        // Clear the input field
        input.value = '';
      }
    });
  
    // Handle receiving messages from the VSCode extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'receiveMessage') {
        const messagesDiv = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message gemini-message';
        messageDiv.textContent = message.text;
        messagesDiv.appendChild(messageDiv);
      }
    });
  })();
  