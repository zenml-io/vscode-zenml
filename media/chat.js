(function() {
    const vscode = acquireVsCodeApi();
  
    // Function to send the message
    function sendMessage() {
        const input = document.getElementById('messageInput');
        if (input.value.trim()) {
            const message = input.value;
            input.value = ''; // Clear input
  
            // Post the message back to the extension
            vscode.postMessage({
                command: 'sendMessage',
                text: message
            });
  
            // Append the message to the chat log
            const messagesDiv = document.getElementById('chatLog');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.textContent = message;
            messagesDiv.appendChild(messageDiv);
        }
    }
  
    // Click event for the send button
    document.getElementById('sendMessage').addEventListener('click', sendMessage);
  
    // Keydown event for the Enter key
    document.getElementById('messageInput').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default Enter key behavior (e.g., newline)
            sendMessage();
        }
    });
  })();