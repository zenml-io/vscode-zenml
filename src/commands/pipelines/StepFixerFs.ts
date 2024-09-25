import path from 'path';
import * as vscode from 'vscode';

export const SaveAIChangeEmitter = new vscode.EventEmitter();

export default class StepFixerFs implements vscode.FileSystemProvider {
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
  'Invalid operation attempted by minimal file system which only supports basic reading and writing to files'
);

class File implements vscode.FileStat {
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

class Directory implements vscode.FileStat {
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

type Entry = File | Directory;
