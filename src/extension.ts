import * as vscode from 'vscode';
import { ZenMLStatusBar } from './views/statusBar';

export function activate(context: vscode.ExtensionContext) {
	console.log('ZenML Studio is now active!');

	const zenMLStatusBar = ZenMLStatusBar.getInstance();

	const refreshCommand = vscode.commands.registerCommand('zenml.showActiveStack', () => {
		zenMLStatusBar.updateStatusBar();
	});

	context.subscriptions.push(refreshCommand);
}

export function deactivate() { }
