import * as vscode from 'vscode';
import { ZenMLStatusBar } from './views/statusBar';
import { Shell } from './utils/shell';

export function activate(context: vscode.ExtensionContext) {
	console.log('ZenML extension is now active!');

	// Initialize a Shell instance (for making calls to the python client)
	const shell = new Shell();

	// Pass the Shell instance to the status bar
	const zenMLStatusBar = ZenMLStatusBar.getInstance(shell);

	// Register Commands
	const updateActiveStackCommand = vscode.commands.registerCommand('zenml.updateActiveStack', async () => {
		await zenMLStatusBar.updateActiveStack();
	});

	const updateServerStatusCommand = vscode.commands.registerCommand('zenml.updateServerStatus', async () => {
		await zenMLStatusBar.checkServerStatus();
	});

	// Add the commands to the context's subscriptions
	context.subscriptions.push(updateActiveStackCommand);
	context.subscriptions.push(updateServerStatusCommand);
}

export function deactivate() { }
