// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
import {
  ConfigurationChangeEvent,
  ConfigurationScope,
  ConfigurationTarget,
  WorkspaceConfiguration,
  WorkspaceFolder,
  workspace,
} from 'vscode';
import { getInterpreterDetails } from './python';
import { getConfiguration, getWorkspaceFolders } from './vscodeapi';
import path from 'path';
import * as fs from 'fs';

export interface ISettings {
  cwd: string;
  workspace: string;
  args: string[];
  path: string[];
  interpreter: string[];
  importStrategy: string;
  showNotifications: string;
}

export function getExtensionSettings(
  namespace: string,
  includeInterpreter?: boolean
): Promise<ISettings[]> {
  return Promise.all(
    getWorkspaceFolders().map(w => getWorkspaceSettings(namespace, w, includeInterpreter))
  );
}

function resolveVariables(
  value: (string | { path: string })[],
  workspace?: WorkspaceFolder
): string[] {
  const substitutions = new Map<string, string>();
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    substitutions.set('${userHome}', home);
  }
  if (workspace) {
    substitutions.set('${workspaceFolder}', workspace.uri.fsPath);
  }
  substitutions.set('${cwd}', process.cwd());
  getWorkspaceFolders().forEach(w => {
    substitutions.set('${workspaceFolder:' + w.name + '}', w.uri.fsPath);
  });

  return value.map(item => {
    // Check if item is an object and has a path property
    if (typeof item === 'object' && 'path' in item) {
      let path = item.path;
      for (const [key, value] of substitutions) {
        path = path.replace(key, value);
      }
      return path;
    } else if (typeof item === 'string') {
      // Item is a string, proceed as before
      for (const [key, value] of substitutions) {
        item = item.replace(key, value);
      }
      return item;
    } else {
      // Item is not a string or does not match the expected structure, log a warning or handle as needed
      console.warn('Item does not match expected format:', item);
      return ''; // or return a sensible default
    }
  });
}

export function getInterpreterFromSetting(namespace: string, scope?: ConfigurationScope) {
  const config = getConfiguration(namespace, scope);
  return config.get<string[]>('interpreter');
}

export async function getWorkspaceSettings(
  namespace: string,
  workspace: WorkspaceFolder,
  includeInterpreter?: boolean
): Promise<ISettings> {
  const config = getConfiguration(namespace, workspace.uri);

  let interpreter: string[] = [];
  if (includeInterpreter) {
    interpreter = getInterpreterFromSetting(namespace, workspace) ?? [];
    if (interpreter.length === 0) {
      interpreter = (await getInterpreterDetails(workspace.uri)).path ?? [];
    }
  }

  const workspaceSetting = {
    cwd: workspace.uri.fsPath,
    workspace: workspace.uri.toString(),
    args: resolveVariables(config.get<string[]>(`args`) ?? [], workspace),
    path: resolveVariables(config.get<string[]>(`path`) ?? [], workspace),
    interpreter: resolveVariables(interpreter, workspace),
    importStrategy: config.get<string>(`importStrategy`) ?? 'useBundled',
    showNotifications: config.get<string>(`showNotifications`) ?? 'off',
  };

  // console.log("WORKSPACE SETTINGS: ", workspaceSetting);

  return workspaceSetting;
}

function getGlobalValue<T>(config: WorkspaceConfiguration, key: string, defaultValue: T): T {
  const inspect = config.inspect<T>(key);
  return inspect?.globalValue ?? inspect?.defaultValue ?? defaultValue;
}

export async function getGlobalSettings(
  namespace: string,
  includeInterpreter?: boolean
): Promise<ISettings> {
  const config = getConfiguration(namespace);

  let interpreter: string[] = [];
  if (includeInterpreter) {
    interpreter = getGlobalValue<string[]>(config, 'interpreter', []);
    if (interpreter === undefined || interpreter.length === 0) {
      interpreter = (await getInterpreterDetails()).path ?? [];
    }
  }

  const debugInterpreter = (await getInterpreterDetails()).path ?? [];
  console.log('Global Interpreter: ', debugInterpreter);

  const setting = {
    cwd: process.cwd(),
    workspace: process.cwd(),
    args: getGlobalValue<string[]>(config, 'args', []),
    path: getGlobalValue<string[]>(config, 'path', []),
    interpreter: interpreter,
    importStrategy: getGlobalValue<string>(config, 'importStrategy', 'useBundled'),
    showNotifications: getGlobalValue<string>(config, 'showNotifications', 'off'),
  };

  // console.log("GLOBAL SETTINGS: ", setting);

  return setting;
}

export function checkIfConfigurationChanged(
  e: ConfigurationChangeEvent,
  namespace: string
): boolean {
  const settings = [
    `${namespace}.args`,
    `${namespace}.path`,
    `${namespace}.interpreter`,
    `${namespace}.importStrategy`,
    `${namespace}.showNotifications`,
  ];
  const changed = settings.map(s => e.affectsConfiguration(s));
  return changed.includes(true);
}

export async function updateWorkspaceInterpreterSettings(interpreterPath: string): Promise<void> {
  const workspaceFolders = workspace.workspaceFolders || [];
  for (const workspaceFolder of workspaceFolders) {
    const workspaceConfig = workspace.getConfiguration('zenml-python', workspaceFolder.uri);
    await workspaceConfig.update('interpreter', [interpreterPath], ConfigurationTarget.Workspace);

    let workspaceSettings: ISettings = await getWorkspaceSettings(
      'zenml-python',
      workspaceFolder,
      true
    );
    const settingsPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      workspaceSettings['interpreter'] = [interpreterPath];
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
    }
  }
}
