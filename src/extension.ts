import * as vscode from 'vscode';
import { ZenMLStatusBar } from './views/statusBar';
import { Shell } from './utils/shell';
import { ServerDataProvider, StackDataProvider } from './views/containers';
import { connectToZenMLServer, disconnectFromZenMLServer } from './commands/serverCommands';

export function activate(context: vscode.ExtensionContext) {
	console.log('ZenML extension is now active!');
	const vscr = vscode.commands.registerCommand
	const shell = new Shell();
	const statusBar = ZenMLStatusBar.getInstance(shell);
	const stackDataProvider = new StackDataProvider(shell);
	const serverDataProvider = new ServerDataProvider(shell);

	// views
	vscode.window.createTreeView('zenmlStackView', { treeDataProvider: stackDataProvider });
	vscode.window.createTreeView('zenmlServerView', { treeDataProvider: serverDataProvider });

	// commands
	const refreshStackView = vscr('zenml.refreshStackView', () => {
		stackDataProvider.refresh()
		vscode.window.showInformationMessage('Refreshing Stack View...');
	});

	const refreshActiveStack = vscr('zenml.refreshActiveStack', async () => {
		await statusBar.refreshActiveStack();
		vscode.window.showInformationMessage('Refreshing Active Stack...');
	})

	const refreshServerStatus = vscr('zenml.refreshServerStatus', () => {
		serverDataProvider.refresh();
		vscode.window.showInformationMessage('Refreshing server status...');
	});

	const connectCommand = vscr('zenml.connectServer', async () => {
		const serverName = await vscode.window.showInputBox({ prompt: 'Enter server name' });
		const username = await vscode.window.showInputBox({ prompt: 'Enter username' });
		const password = await vscode.window.showInputBox({ prompt: 'Enter password', password: true });

		if (!serverName || !username || !password) {
			vscode.window.showErrorMessage('Server name, username, and password are required to connect.');
			return;
		}

		const success = await connectToZenMLServer(shell, serverName, username, password);
		if (success) {
			vscode.window.showInformationMessage('Successfully connected to ZenML server.');
		} else {
			vscode.window.showErrorMessage('Failed to connect to ZenML server.');
		}
	});

	const disconnectCommand = vscr('zenml.disconnectServer', async () => {
		const success = await disconnectFromZenMLServer(shell);
		if (success) {
			vscode.window.showInformationMessage('Successfully disconnected from ZenML server.');
		} else {
			vscode.window.showErrorMessage('Failed to disconnect from ZenML server.');
		}
	});


	context.subscriptions.push(
		connectCommand,
		disconnectCommand,
		refreshStackView,
		refreshActiveStack,
		refreshServerStatus
	);
}

export function deactivate() { }
