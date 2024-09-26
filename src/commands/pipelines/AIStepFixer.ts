import * as vscode from 'vscode';
import { searchGitCacheByFileContent, searchWorkspaceByFileContent } from '../../common/utilities';
import fs from 'fs/promises';
import { LSClient } from '../../services/LSClient';
import Panels from '../../common/panels';
import { AIService } from '../../services/aiService';
import { PipelineTreeItem } from '../../views/activityBar';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';
import * as path from 'path';
import WebviewBase from '../../common/WebviewBase';
import MultiStepInput, { InputStep } from './MultiStepInput';
import StepFixerFs, { SaveAIChangeEmitter } from './StepFixerFs';
import { SupportedLLMModels, SupportedLLMProviders } from '../../services/aiService';
import { randomUUID } from 'crypto';

export default class AIStepFixer extends WebviewBase {
  private static instance: AIStepFixer;
  private stepFs: StepFixerFs;

  private constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension Context Not Propagated');
    }
    this.stepFs = new StepFixerFs();

    vscode.workspace.registerFileSystemProvider('zenml-stepfixer', this.stepFs, {
      isCaseSensitive: true,
    });

    vscode.window.tabGroups.onDidChangeTabs(evt => {
      const input = evt.closed[0]?.input;
      if (typeof input !== 'object' || input === null || !('modified' in input)) {
        return;
      }
      const uri = input.modified;
      if (typeof uri !== 'object' || uri === null || !('path' in uri)) {
        return;
      }
      const recIndex = this.codeRecommendations.findIndex(
        ele => ele.recUri?.toString() === uri.toString()
      );
      if (recIndex === -1) {
        return;
      }

      setTimeout(() => {
        const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        const uris = tabs.filter(tab => 'uri' in tab).map(tab => tab.uri as vscode.Uri);
        if (uris.some(tabUri => tabUri.toString() === uri.toString())) {
          return;
        }

        this.codeRecommendations.splice(recIndex, 1);
        this.updateRecommendationsContext();
      }, 1000);
    });

    vscode.workspace.onWillSaveTextDocument(async e => {
      const rec = this.codeRecommendations.find(
        ele => e.document.fileName === `/${path.posix.basename(ele.recUri?.path || '')}`
      );

      if (
        !rec ||
        e.document.uri.scheme !== 'zenml-stepfixer' ||
        e.reason !== vscode.TextDocumentSaveReason.Manual
      ) {
        return;
      }

      try {
        await fs.writeFile(rec.sourceUri.fsPath, e.document.getText());
      } catch (e) {
        const error = e as Error;
        vscode.window.showErrorMessage(`Failed to save AI recommendation: ${error.message}`);
      }
    });

    SaveAIChangeEmitter.event(async doc => {
      const rec = this.codeRecommendations.find(
        ele => ele.recUri?.toString() === doc.uri.toString()
      );

      if (!rec || doc.uri.toString() !== rec.recUri?.toString()) {
        return;
      }

      try {
        await fs.writeFile(rec.sourceUri.fsPath, doc.getText());
      } catch (e) {
        const error = e as Error;
        vscode.window.showErrorMessage(`Failed to save AI recommendation: ${error.message}`);
      }
    });
  }

  public static getInstance() {
    if (!AIStepFixer.instance) {
      AIStepFixer.instance = new AIStepFixer();
    }
    return AIStepFixer.instance;
  }

  private codeRecommendations: {
    sourceUri: vscode.Uri;
    recUri: vscode.Uri | undefined;
    code: string[];
    sourceCode: string;
    currentCodeIndex: number;
  }[] = [];

  public async selectLLM() {
    if (!WebviewBase.context) {
      return;
    }

    const providers: vscode.QuickPickItem[] = AIService.getInstance(WebviewBase.context)
      .getSupportedProviders()
      .map(label => ({
        label,
      }));

    interface State {
      title: string;
      step: number;
      totalSteps: number;
      provider: vscode.QuickPickItem;
      model: vscode.QuickPickItem;
    }
    const title = 'Select AI Model';

    async function collectInputs() {
      const state = {} as Partial<State>;
      await MultiStepInput.run(input => pickProvider(input, state));
      return state as State;
    }

    async function pickProvider(input: MultiStepInput, state: Partial<State>): Promise<InputStep> {
      const pick = await input.showQuickPick({
        title,
        step: 1,
        totalSteps: 2,
        placeholder: `Select your model's provider`,
        items: providers,
        activeItem: typeof state.provider !== 'string' ? state.provider : undefined,
        shouldResume: shouldResume,
      });
      state.provider = pick;
      return (input: MultiStepInput) => pickModel(input, state);
    }

    async function pickModel(input: MultiStepInput, state: Partial<State>): Promise<undefined> {
      const models = await getAvailableModels(state.provider!);
      state.model = await input.showQuickPick({
        title,
        step: 2,
        totalSteps: 2,
        placeholder: 'Select your model',
        items: models,
        activeItem: state.model,
        shouldResume: shouldResume,
      });
    }

    async function getAvailableModels(
      provider: vscode.QuickPickItem
    ): Promise<vscode.QuickPickItem[]> {
      if (!WebviewBase.context) return [];
      if (!providers.find(p => p.label === provider.label)) return [];

      return (
        await AIService.getInstance(WebviewBase.context).getSupportedModels(
          provider.label as SupportedLLMProviders
        )
      ).map(label => ({
        label,
      }));
    }

    const shouldResume = () => Promise.resolve(false);

    const state = await collectInputs();
    AIService.getInstance(WebviewBase.context).setModel(
      state.provider.label as SupportedLLMProviders,
      state.model.label as SupportedLLMModels
    );
    vscode.window.showInformationMessage(`Set default AI model to ${state.model.label}`);
  }

  public async suggestFixForStep(id: string, node: PipelineTreeItem): Promise<void> {
    if (!WebviewBase.context) {
      return;
    }

    const client = LSClient.getInstance();
    const stepData = await client.sendLsClientRequest<JsonObject>('getPipelineRunStep', [id]);
    let log;
    try {
      log = await fs.readFile(String(stepData.logsUri), { encoding: 'utf-8' });
    } catch (e) {
      const error = e as Error;
      vscode.window.showErrorMessage(`Failed to read pipeline run logs file: ${error.message}`);
      return;
    }

    const p = Panels.getInstance();
    const existingPanel = p.getPanel(node.id);
    const ai = AIService.getInstance(WebviewBase.context);

    let response;
    try {
      response = await ai.fixMyPipelineRequest(log, String(stepData.sourceCode));
    } catch (e) {
      const error = e as Error;
      vscode.window.showErrorMessage(`Failed to get AI fix: ${error.message}`);
      this.closeWebviewContextMenu(existingPanel);
      return;
    }
    if (!response) {
      this.closeWebviewContextMenu(existingPanel);
      return;
    }

    const { message, code } = response;
    const codeChoices = code
      .map(c => {
        return c.content;
      })
      .filter(content => content);

    let sourceCodeFileMatches = await searchWorkspaceByFileContent(
      String(stepData.sourceCode).trim()
    );

    if (sourceCodeFileMatches.length === 0) {
      sourceCodeFileMatches = await searchGitCacheByFileContent(String(stepData.sourceCode).trim());
      vscode.window.showInformationMessage(
        `We could not find a local file with this step in your current workspace, but found one cached in the nearest git log.`
      );
    }

    if (codeChoices.length > 0) {
      if (sourceCodeFileMatches.length === 0) {
        vscode.window.showWarningMessage(
          `We could not find a file with this step in your local environment, so cannot display inline recommendations. If the file is local, make sure it is available within your VSCode workspace and try again.`
        );
      } else if (sourceCodeFileMatches.length > 1) {
        vscode.window.showWarningMessage(
          `We found multiple files with this step in your local environment, so cannot determine in which file to display inline recommendations. If you would like inline recommendations, you can adjust your VSCode environment so that it contains only one file with the registered step and try again.`
        );
      } else if (sourceCodeFileMatches.length === 1) {
        this.createCodeRecommendation(
          sourceCodeFileMatches[0].uri,
          codeChoices,
          String(stepData.sourceCode).trim(),
          existingPanel,
          sourceCodeFileMatches[0].content
        );
      }
    }

    this.createVirtualDocument(id, message || 'Something went wrong', existingPanel);
    this.closeWebviewContextMenu(existingPanel);
  }

  public async updateCodeRecommendation(recUri: vscode.Uri) {
    const rec = this.codeRecommendations.find(rec => rec.recUri?.toString === recUri.toString);
    if (!rec) {
      return;
    }

    rec.currentCodeIndex =
      rec.currentCodeIndex + 1 < rec.code.length ? rec.currentCodeIndex + 1 : 0;

    this.editStepFile(rec.sourceUri, rec.code[rec.currentCodeIndex], rec.sourceCode, false);
  }

  private closeWebviewContextMenu(existingPanel: vscode.WebviewPanel | undefined) {
    if (existingPanel) {
      existingPanel.webview.postMessage({ command: 'closeContextMenu' });
    }
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
    const uri = vscode.Uri.parse(`fix-my-pipeline:${randomUUID()}.md`);

    if (existingPanel) {
      existingPanel.reveal(existingPanel.viewColumn, false);
    }
    vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
  }

  private createCodeRecommendation(
    sourceUri: vscode.Uri,
    code: string[],
    sourceCode: string,
    existingPanel?: vscode.WebviewPanel,
    fileContents?: string
  ) {
    const rec = this.codeRecommendations.find(
      rec => rec.sourceUri.toString() === sourceUri.toString()
    );

    if (!rec && code.length > 1) {
      this.codeRecommendations.push({
        sourceUri,
        recUri: undefined,
        code,
        sourceCode,
        currentCodeIndex: 0,
      });
      this.updateRecommendationsContext();
    }

    this.editStepFile(sourceUri, code[0], sourceCode, true, existingPanel, fileContents);
  }

  private async editStepFile(
    sourceUri: vscode.Uri,
    newContent: string,
    oldContent: string,
    openFile = true,
    existingPanel?: vscode.WebviewPanel,
    fileContents?: string
  ) {
    if (!fileContents) {
      fileContents = await (async () => {
        try {
          return await fs.readFile(sourceUri.fsPath, { encoding: 'utf-8' });
        } catch (e) {
          const error = e as Error;
          vscode.window.showErrorMessage(`Failed to read source file: ${error.message}`);
          return ''; // Return empty content or handle accordingly
        }
      })();
    }

    const fileName = path.posix.basename(sourceUri.path);
    const recName = `Recommendations for ${fileName}`;

    await this.stepFs.writeFile(
      vscode.Uri.parse(`zenml-stepfixer:/${fileName}`),
      Buffer.from(fileContents.replace(oldContent, newContent)),
      {
        create: true,
        overwrite: true,
      }
    );

    const recUri = vscode.Uri.parse(`zenml-stepfixer:/${fileName}`);
    const rec = this.codeRecommendations.find(
      ele => ele.sourceUri.toString() === sourceUri.toString()
    );
    if (rec) {
      rec.recUri = recUri;
      this.updateRecommendationsContext();
    }

    if (openFile) {
      if (existingPanel) {
        existingPanel.reveal(existingPanel.viewColumn, false);
      }
      vscode.commands.executeCommand('vscode.diff', sourceUri, recUri, recName);
    }
  }

  private updateRecommendationsContext() {
    vscode.commands.executeCommand(
      'setContext',
      'zenml.aiCodeRecommendations',
      this.codeRecommendations
        .filter(rec => rec.recUri)
        .map(rec => path.posix.basename(rec.recUri?.fsPath || ''))
    );
  }
}
