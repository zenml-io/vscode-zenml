import * as vscode from 'vscode';
import { searchGitCacheByFileContent, searchWorkspaceByFileContent } from '../../common/utilities';
import fs from 'fs/promises';
import { integer } from 'vscode-languageclient';
import { LSClient } from '../../services/LSClient';
import Panels from '../../common/panels';
import { AIService } from '../../services/aiService';
import { PipelineTreeItem } from '../../views/activityBar';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';
import * as path from 'path';
import WebviewBase from '../../common/WebviewBase';

export default class AIStepFixer extends WebviewBase {
  private static instance: AIStepFixer;
  public static providers = ['Anthropic (Claude)', 'Google (Gemini)', 'OpenAI (ChatGPT)'];
  private minFS: MinimalFS;

  private constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension Context Not Propagated');
    }
    this.minFS = new MinimalFS();

    vscode.workspace.registerFileSystemProvider('zenml-minfs', this.minFS, {
      isCaseSensitive: true,
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
    currentCodeIndex: integer;
  }[] = [];

  public async selectLLM() {
    if (!WebviewBase.context) {
      return;
    }
    multiStepInput(WebviewBase.context);
  }

  public async suggestFixForStep(id: string, node: PipelineTreeItem): Promise<void> {
    if (!WebviewBase.context) {
      return;
    }

    const client = LSClient.getInstance();
    const stepData = await client.sendLsClientRequest<JsonObject>('getPipelineRunStep', [id]);
    const log = await fs.readFile(String(stepData.logsUri), { encoding: 'utf-8' });
    const p = Panels.getInstance();
    const existingPanel = p.getPanel(node.id);
    const ai = AIService.getInstance(WebviewBase.context);

    const response = await ai.fixMyPipelineRequest(log, String(stepData.sourceCode));

    if (!response) {
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

    this.createVirtualDocument(id, message || 'Something went wrong', existingPanel);

    if (existingPanel) {
      existingPanel.webview.postMessage('AI Query Complete');
    }
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
    const uri = vscode.Uri.parse(`fix-my-pipeline:${id}.md`);

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

        // TODO change this to use TabGroups
        setTimeout(() => {
          const editors = vscode.window.visibleTextEditors;
          if (editors.some(editor => editor.document.uri.toString() === uri.toString())) {
            return;
          }

          this.codeRecommendations.splice(recIndex, 1);
          this.updateRecommendationsContext();
        }, 1000);
      });
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
    fileContents = fileContents
      ? fileContents
      : await fs.readFile(sourceUri.fsPath, { encoding: 'utf-8' });
    const fileName = path.posix.basename(sourceUri.path);

    const recName = `Recommendations for ${fileName}`;
    // TODO update to throw error if oldContent is not found in fileContents
    await this.minFS.writeFile(
      vscode.Uri.parse(`zenml-minfs:/${fileName}`),
      Buffer.from(fileContents.replace(oldContent, newContent)),
      {
        create: true,
        overwrite: true,
      }
    );

    const recUri = vscode.Uri.parse(`zenml-minfs:/${fileName}`);
    const rec = this.codeRecommendations.find(
      ele => ele.sourceUri.toString() === sourceUri.toString()
    );
    if (rec) {
      rec.recUri = recUri;
      this.updateRecommendationsContext();
    }

    vscode.workspace.onWillSaveTextDocument(async e => {
      if (
        e.document.uri.scheme !== 'zenml-minfs' ||
        e.document.fileName !== `/${fileName}` ||
        e.reason !== vscode.TextDocumentSaveReason.Manual
      ) {
        return;
      }

      fs.writeFile(sourceUri.fsPath, e.document.getText());
    });

    SaveAIChangeEmitter.event(doc => {
      if (
        !doc ||
        !(typeof doc === 'object') ||
        !('uri' in doc) ||
        !(doc.uri instanceof vscode.Uri) ||
        doc.uri.toString() !== recUri.toString() ||
        !('getText' in doc) ||
        !(typeof doc.getText === 'function')
      ) {
        return;
      }

      fs.writeFile(sourceUri.fsPath, doc.getText());
    });

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

class MinimalFS implements vscode.FileSystemProvider {
  root = new Directory('');

  stat(uri: vscode.Uri): vscode.FileStat {
    return this._lookup(uri, false);
  }

  // --- manage file contents

  readFile(uri: vscode.Uri): Uint8Array {
    const data = this._lookupAsFile(uri, false).data;
    if (data) {
      return data;
    }
    throw vscode.FileSystemError.FileNotFound();
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupParentDirectory(uri);
    let entry = parent.entries.get(basename);
    if (entry instanceof Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (!entry && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (entry && options.create && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    if (!entry) {
      entry = new File(basename);
      parent.entries.set(basename, entry);
      this._fireSoon({ type: vscode.FileChangeType.Created, uri });
    }
    entry.mtime = Date.now();
    entry.size = content.byteLength;
    entry.data = content;

    this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
  }

  // --- lookup

  private _lookup(uri: vscode.Uri, silent: false): Entry;
  private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
  private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
    const parts = uri.path.split('/');
    let entry: Entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child: Entry | undefined;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }
      if (!child) {
        if (!silent) {
          throw vscode.FileSystemError.FileNotFound(uri);
        } else {
          return undefined;
        }
      }
      entry = child;
    }
    return entry;
  }

  private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw vscode.FileSystemError.FileNotADirectory(uri);
  }

  private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw vscode.FileSystemError.FileIsADirectory(uri);
  }

  private _lookupParentDirectory(uri: vscode.Uri): Directory {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    return this._lookupAsDirectory(dirname, false);
  }

  // --- manage file events

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timeout;

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  private _fireSoon(...events: vscode.FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }

  // --- unused

  watch(_resource: vscode.Uri): vscode.Disposable {
    throw MinFSError;
  }
  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    throw MinFSError;
  }
  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    throw MinFSError;
  }
  delete(uri: vscode.Uri): void {
    throw MinFSError;
  }
  createDirectory(uri: vscode.Uri): void {
    throw MinFSError;
  }
}

const MinFSError = new Error(
  'Operation attempted by minimal file system which only supports basic reading and writing to files'
);

export class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  data?: Uint8Array;

  constructor(name: string) {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}

export class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  entries: Map<string, File | Directory>;

  constructor(name: string) {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = new Map();
  }
}

export type Entry = File | Directory;

export const SaveAIChangeEmitter = new vscode.EventEmitter();

export async function multiStepInput(context: vscode.ExtensionContext) {
  const providers: vscode.QuickPickItem[] = AIStepFixer.providers.map(label => ({ label }));

  interface State {
    title: string;
    step: number;
    totalSteps: number;
    provider: vscode.QuickPickItem | string;
    model: vscode.QuickPickItem;
  }
  const title = 'Select AI Model';

  async function collectInputs() {
    const state = {} as Partial<State>;
    await MultiStepInput.run(input => pickProvider(input, state));
    return state as State;
  }

  async function pickProvider(input: MultiStepInput, state: Partial<State>) {
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

  async function pickModel(input: MultiStepInput, state: Partial<State>) {
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
    provider: vscode.QuickPickItem | string
  ): Promise<vscode.QuickPickItem[]> {
    provider = typeof provider === 'string' ? provider : provider.label;
    provider = provider.split(' ')[0];
    if (!supportedLLMProviders.find(p => p === provider)) {
      return [];
    }

    return AIService.getInstance(context)
      .getModels(provider)
      .map(label => ({ label }));
  }

  const shouldResume = () => new Promise<boolean>(() => {});

  const state = await collectInputs();
  AIService.getInstance(context).setDefaultModel(state.model.label);
  vscode.window.showInformationMessage(`Set default AI model to ${state.model.label}`);
}

// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------
const supportedLLMProviders = ['Anthropic', 'Google', 'OpenAI'];
export type SupportedLLMProviders = (typeof supportedLLMProviders)[number];

class InputFlowAction {
  static back = new InputFlowAction();
  static cancel = new InputFlowAction();
  static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends vscode.QuickPickItem> {
  title: string;
  step: number;
  totalSteps: number;
  items: T[];
  activeItem?: T;
  ignoreFocusOut?: boolean;
  placeholder: string;
  buttons?: vscode.QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
  title: string;
  step: number;
  totalSteps: number;
  value: string;
  prompt: string;
  validate: (value: string) => Promise<string | undefined>;
  buttons?: vscode.QuickInputButton[];
  ignoreFocusOut?: boolean;
  placeholder?: string;
  shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {
  static async run<T>(start: InputStep) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  private current?: vscode.QuickInput;
  private steps: InputStep[] = [];

  private async stepThrough<T>(start: InputStep) {
    let step: InputStep | void = start;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (err) {
        if (err === InputFlowAction.back) {
          this.steps.pop();
          step = this.steps.pop();
        } else if (err === InputFlowAction.resume) {
          step = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          step = undefined;
        } else {
          throw err;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
  }

  async showQuickPick<T extends vscode.QuickPickItem, P extends QuickPickParameters<T>>({
    title,
    step,
    totalSteps,
    items,
    activeItem,
    ignoreFocusOut,
    placeholder,
    buttons,
    shouldResume,
  }: P) {
    const disposables: vscode.Disposable[] = [];
    try {
      return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>(
        (resolve, reject) => {
          const input = vscode.window.createQuickPick<T>();
          input.title = title;
          input.step = step;
          input.totalSteps = totalSteps;
          input.ignoreFocusOut = ignoreFocusOut ?? false;
          input.placeholder = placeholder;
          input.items = items;
          if (activeItem) {
            input.activeItems = [activeItem];
          }
          input.buttons = [
            ...(this.steps.length > 1 ? [vscode.QuickInputButtons.Back] : []),
            ...(buttons || []),
          ];
          disposables.push(
            input.onDidTriggerButton(item => {
              if (item === vscode.QuickInputButtons.Back) {
                reject(InputFlowAction.back);
              } else {
                resolve(<any>item);
              }
            }),
            input.onDidChangeSelection(items => resolve(items[0])),
            input.onDidHide(() => {
              (async () => {
                reject(
                  shouldResume && (await shouldResume())
                    ? InputFlowAction.resume
                    : InputFlowAction.cancel
                );
              })().catch(reject);
            })
          );
          if (this.current) {
            this.current.dispose();
          }
          this.current = input;
          this.current.show();
        }
      );
    } finally {
      disposables.forEach(d => d.dispose());
    }
  }

  async showInputBox<P extends InputBoxParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    validate,
    buttons,
    ignoreFocusOut,
    placeholder,
    shouldResume,
  }: P) {
    const disposables: vscode.Disposable[] = [];
    try {
      return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>(
        (resolve, reject) => {
          const input = vscode.window.createInputBox();
          input.title = title;
          input.step = step;
          input.totalSteps = totalSteps;
          input.value = value || '';
          input.prompt = prompt;
          input.ignoreFocusOut = ignoreFocusOut ?? false;
          input.placeholder = placeholder;
          input.buttons = [
            ...(this.steps.length > 1 ? [vscode.QuickInputButtons.Back] : []),
            ...(buttons || []),
          ];
          let validating = validate('');
          disposables.push(
            input.onDidTriggerButton(item => {
              if (item === vscode.QuickInputButtons.Back) {
                reject(InputFlowAction.back);
              } else {
                resolve(<any>item);
              }
            }),
            input.onDidAccept(async () => {
              const value = input.value;
              input.enabled = false;
              input.busy = true;
              if (!(await validate(value))) {
                resolve(value);
              }
              input.enabled = true;
              input.busy = false;
            }),
            input.onDidChangeValue(async text => {
              const current = validate(text);
              validating = current;
              const validationMessage = await current;
              if (current === validating) {
                input.validationMessage = validationMessage;
              }
            }),
            input.onDidHide(() => {
              (async () => {
                reject(
                  shouldResume && (await shouldResume())
                    ? InputFlowAction.resume
                    : InputFlowAction.cancel
                );
              })().catch(reject);
            })
          );
          if (this.current) {
            this.current.dispose();
          }
          this.current = input;
          this.current.show();
        }
      );
    } finally {
      disposables.forEach(d => d.dispose());
    }
  }
}
