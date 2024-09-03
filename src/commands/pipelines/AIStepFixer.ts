import * as vscode from 'vscode';
import { findFirstLineNumber } from '../../common/utilities';
import fs from 'fs/promises';
import { integer } from 'vscode-languageclient';
import { LSClient } from '../../services/LSClient';
import Panels from '../../common/panels';
import { fixMyPipelineRequest } from '../../services/aiService';
import { PipelineTreeItem } from '../../views/activityBar';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';

export default new (class AIStepFixer {
  private codeRecommendations: {
    filePath: string;
    code: string[];
    sourceCode: string;
    currentCodeIndex: integer;
  }[] = [];

  public async suggestFixForStep(
    id: string,
    node: PipelineTreeItem,
    context: vscode.ExtensionContext
  ): Promise<void> {
    const client = LSClient.getInstance();
    const stepData = await client.sendLsClientRequest<JsonObject>('getPipelineRunStep', [id]);
    const log = await fs.readFile(String(stepData.logsUri), { encoding: 'utf-8' });
    const p = Panels.getInstance();
    const existingPanel = p.getPanel(node.id);

    const response = await fixMyPipelineRequest(context, log, String(stepData.sourceCode));

    const [chatCompletion, codeCompletion] = response;

    const codeChoices = codeCompletion.choices
      .map(choice => {
        return choice.message.content?.match(/(?<=```\S*\s)[\s\S]*(?=\s```)/)?.[0] || '';
      })
      .filter(content => content);

    const HARDCODED_PATH = '/home/memlin/zenml/zenml_tutorial/steps/inference_preprocessor.py';

    this.createCodeRecommendation(
      HARDCODED_PATH,
      codeChoices,
      String(stepData.sourceCode),
      existingPanel
    );
    this.createVirtualDocument(
      id,
      chatCompletion.choices[0].message.content || 'Something went wrong',
      existingPanel
    );

    if (existingPanel) existingPanel.webview.postMessage('AI Query Complete');
  }

  public async updateCodeRecommendation(filePath: string) {
    const rec = this.codeRecommendations.find(rec => rec.filePath === filePath);
    if (!rec) return;

    rec.currentCodeIndex =
      rec.currentCodeIndex + 1 < rec.code.length ? rec.currentCodeIndex + 1 : 0;

    this.editStepFile(rec.filePath, rec.code[rec.currentCodeIndex], rec.sourceCode, false);
  }

  private async createVirtualDocument(
    id: string,
    content: string,
    existingPanel?: vscode.WebviewPanel
  ) {
    const provider = new (class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        return content;
      }
    })();

    vscode.workspace.registerTextDocumentContentProvider('fix-my-pipeline', provider);
    const uri = vscode.Uri.parse('fix-my-pipeline:' + id + '.md');

    if (existingPanel) existingPanel.reveal(existingPanel.viewColumn, false);
    vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
  }

  private createCodeRecommendation(
    filePath: string,
    code: string[],
    sourceCode: string,
    existingPanel?: vscode.WebviewPanel
  ) {
    const rec = this.codeRecommendations.find(rec => rec.filePath === filePath);

    if (!rec && code.length > 1) {
      this.codeRecommendations.push({ filePath, code, sourceCode, currentCodeIndex: 0 });
      this.updateRecommendationsContext();

      vscode.window.tabGroups.onDidChangeTabs(evt => {
        const input = evt.closed[0]?.input;
        if (typeof input !== 'object' || input === null || !('modified' in input)) return;
        const uri = input.modified;
        if (typeof uri !== 'object' || uri === null || !('path' in uri)) return;
        const recIndex = this.codeRecommendations.findIndex(ele => ele.filePath === uri.path);
        if (recIndex === -1) return;

        setTimeout(() => {
          const editors = vscode.window.visibleTextEditors;
          if (editors.some(editor => editor.document.fileName === uri.path)) return;

          this.codeRecommendations.splice(recIndex, 1);
          this.updateRecommendationsContext();
        }, 1000);
      });
    }

    this.editStepFile(filePath, code[0], sourceCode, true, existingPanel);
  }

  // TODO store the original fileContents in codeRecommendations, so that code recommendations can be made even after
  // TODO the user has made changes to the file
  private async editStepFile(
    filePath: string,
    newContent: string,
    oldContent: string,
    openFile = true,
    existingPanel?: vscode.WebviewPanel
  ) {
    const fileContents = await fs.readFile(filePath, { encoding: 'utf-8' });
    // TODO update to throw error if oldContent is not found in fileContents
    const firstLine = new vscode.Position(findFirstLineNumber(fileContents, oldContent) || 0, 0);
    const lastLine = new vscode.Position(firstLine.line + oldContent.split('\n').length, 0);
    const oldRange = new vscode.Range(firstLine, lastLine);
    const fileUri = vscode.Uri.file(filePath);

    const edit = new vscode.WorkspaceEdit();
    edit.replace(fileUri, oldRange, newContent);

    const success = await vscode.workspace.applyEdit(edit);
    if (success && openFile) {
      if (existingPanel) existingPanel.reveal(existingPanel.viewColumn, false);
      vscode.commands.executeCommand('workbench.files.action.compareWithSaved', fileUri);
    } else if (!success) {
      // TODO proper error handling
      vscode.window.showInformationMessage('Error!');
    }
  }

  private updateRecommendationsContext() {
    vscode.commands.executeCommand(
      'setContext',
      'zenml.aiCodeRecommendations',
      this.codeRecommendations.map(rec => rec.filePath)
    );
  }
})();
