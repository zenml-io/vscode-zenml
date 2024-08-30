import * as vscode from 'vscode';
import { findFirstLineNumber } from '../../common/utilities';
import fs from 'fs/promises';
import { integer } from 'vscode-languageclient';

// TODO remove codeRecommendations from AIStepFixer when they're closed / not found
export default new (class AIStepFixer {
  private codeRecommendations: {
    filePath: string;
    code: string[];
    sourceCode: string;
    currentCodeIndex: integer;
  }[] = [];

  public async createVirtualDocument(id: string, content: string) {
    const provider = new (class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        return content;
      }
    })();

    vscode.workspace.registerTextDocumentContentProvider('fix-my-pipeline', provider);
    const uri = vscode.Uri.parse('fix-my-pipeline:' + id + '.md');
    await vscode.workspace.openTextDocument(uri);

    vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
  }

  public createCodeRecommendation(filePath: string, code: string[], sourceCode: string) {
    const rec = this.codeRecommendations.find(rec => rec.filePath === filePath);

    if (rec) {
      this.codeRecommendations.push({ filePath, code, sourceCode, currentCodeIndex: 0 });
      vscode.commands.executeCommand(
        'setContext',
        'zenml.aiCodeRecommendations',
        this.codeRecommendations.map(rec => rec.filePath)
      );
    }

    this.editStepFile(filePath, code[0], sourceCode);
  }

  public async updateCodeRecommendation(filePath: string) {
    const rec = this.codeRecommendations.find(rec => rec.filePath === filePath);
    if (!rec) return;

    rec.currentCodeIndex =
      rec.currentCodeIndex + 1 < rec.code.length ? rec.currentCodeIndex + 1 : 0;

    this.editStepFile(rec.filePath, rec.code[rec.currentCodeIndex], rec.sourceCode, false);
  }

  private async editStepFile(
    filePath: string,
    newContent: string,
    oldContent: string,
    openFile = true
  ) {
    const fileContents = await fs.readFile(filePath, { encoding: 'utf-8' });
    // TODO update to throw error if oldContent is not found in fileContents
    const firstLine = new vscode.Position(findFirstLineNumber(fileContents, oldContent) || 0, 0);
    const lastLine = new vscode.Position(firstLine.line + oldContent.split('\n').length, 0);
    const oldRange = new vscode.Range(firstLine, lastLine);
    const fileUri = vscode.Uri.file(filePath);

    const edit = new vscode.WorkspaceEdit();
    edit.replace(fileUri, oldRange, newContent);

    return vscode.workspace.applyEdit(edit).then(async success => {
      if (success && openFile) {
        vscode.commands.executeCommand('workbench.files.action.compareWithSaved', fileUri);
      } else if (!success) {
        // TODO proper error handling
        vscode.window.showInformationMessage('Error!');
      }
    });
  }
})();
