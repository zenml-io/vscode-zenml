import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('zenml.zenml'));
	});

	test('Extension should activate', async () => {
		const extension = vscode.extensions.getExtension('zenml.zenml');
		if (extension) {
			await extension.activate();
			assert.ok(extension.isActive, 'Extension did not activate as expected.');
		} else {
			assert.fail('Extension zenml could not be found.');
		}
	});
});
