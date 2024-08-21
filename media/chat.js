(function() {
    const vscode = acquireVsCodeApi();

    document.getElementById('send').addEventListener('click', () => {
        const input = document.getElementById('input');
        if (input.value.trim()) {
            const message = input.value;
            input.value = '';

            // Post the message back to the extension
            vscode.postMessage({
                command: 'sendMessage',
                text: message
            });

            // Append the message to the chat log
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.textContent = message;
            messagesDiv.appendChild(messageDiv);
        }
    });
})();
