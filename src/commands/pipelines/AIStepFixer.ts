import * as vscode from 'vscode';
import { findFirstLineNumber, searchWorkspaceByFileContent } from '../../common/utilities';
import fs from 'fs/promises';
import { integer } from 'vscode-languageclient';
import { LSClient } from '../../services/LSClient';
import Panels from '../../common/panels';
import { AIService } from '../../services/aiService';
import { PipelineTreeItem } from '../../views/activityBar';
import { JsonObject } from '../../views/panel/panelView/PanelTreeItem';
import * as path from 'path';

export default class AIStepFixer {
  private static instance: AIStepFixer;
  private minFS: MinimalFS;

  private constructor() {
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
    const ai = AIService.getInstance(context);

    const response = await ai.fixMyPipelineRequest(log, String(stepData.sourceCode));

    if (!response) return;
    const { message, code } = response;

    const codeChoices = code
      .map(c => {
        return c.content;
      })
      .filter(content => content);

    const sourceCodeFileMatches = await searchWorkspaceByFileContent(
      String(stepData.sourceCode).trim()
    );

    // TODO manage the possibility of zero or multiple files containing the source code
    this.createCodeRecommendation(
      sourceCodeFileMatches[0],
      codeChoices,
      String(stepData.sourceCode).trim(),
      existingPanel
    );
    this.createVirtualDocument(id, message || 'Something went wrong', existingPanel);

    if (existingPanel) existingPanel.webview.postMessage('AI Query Complete');
  }

  public async updateCodeRecommendation(recUri: vscode.Uri) {
    const rec = this.codeRecommendations.find(rec => rec.recUri?.toString === recUri.toString);
    if (!rec) return;

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
    const uri = vscode.Uri.parse('fix-my-pipeline:' + id + '.md');

    if (existingPanel) existingPanel.reveal(existingPanel.viewColumn, false);
    vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
  }

  private createCodeRecommendation(
    sourceUri: vscode.Uri,
    code: string[],
    sourceCode: string,
    existingPanel?: vscode.WebviewPanel
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
        if (typeof input !== 'object' || input === null || !('modified' in input)) return;
        const uri = input.modified;
        if (typeof uri !== 'object' || uri === null || !('path' in uri)) return;
        const recIndex = this.codeRecommendations.findIndex(
          ele => ele.recUri?.toString() === uri.toString()
        );
        if (recIndex === -1) return;

        setTimeout(() => {
          const editors = vscode.window.visibleTextEditors;
          if (editors.some(editor => editor.document.uri.toString() === uri.toString())) return;

          this.codeRecommendations.splice(recIndex, 1);
          this.updateRecommendationsContext();
        }, 1000);
      });
    }

    this.editStepFile(sourceUri, code[0], sourceCode, true, existingPanel);
  }

  // TODO store the original fileContents in codeRecommendations, so that code recommendations can be made even after
  // TODO the user has made changes to the file
  private async editStepFile(
    sourceUri: vscode.Uri,
    newContent: string,
    oldContent: string,
    openFile = true,
    existingPanel?: vscode.WebviewPanel
  ) {
    const fileContents = await fs.readFile(sourceUri.fsPath, { encoding: 'utf-8' });
    const fileName = path.posix.basename(sourceUri.path);
    const firstLine = new vscode.Position(findFirstLineNumber(fileContents, oldContent) || 0, 0);
    const lastLine = new vscode.Position(firstLine.line + oldContent.split('\n').length, 0);
    const oldRange = new vscode.Range(firstLine, lastLine);

    const recName = `Recommendations for ${fileName}`;
    // TODO update to throw error if oldContent is not found in fileContents
    await this.minFS.writeFile(
      vscode.Uri.parse(`zenml-minfs:/${fileName}`),
      Buffer.from(fileContents),
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

    vscode.workspace.onWillSaveTextDocument(e => {
      if (
        e.document.uri.scheme !== 'zenml-minfs' ||
        e.document.fileName !== `/${fileName}` ||
        e.reason !== vscode.TextDocumentSaveReason.Manual
      )
        return;

      fs.writeFile(sourceUri.fsPath, e.document.getText());
    });

    const edit = new vscode.WorkspaceEdit();
    edit.replace(recUri, oldRange, newContent);

    const success = await vscode.workspace.applyEdit(edit);
    if (success && openFile) {
      if (existingPanel) existingPanel.reveal(existingPanel.viewColumn, false);
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
