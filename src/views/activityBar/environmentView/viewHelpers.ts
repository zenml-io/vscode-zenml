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
import { TreeItemCollapsibleState } from 'vscode';
import { EnvironmentItem } from './EnvironmentItem';
import { getInterpreterDetails, resolveInterpreter } from '../../../common/python';
import { getWorkspaceSettings } from '../../../common/settings';
import { PYTOOL_MODULE } from '../../../utils/constants';
import { getProjectRoot } from '../../../common/utilities';
import { LSClient } from '../../../services/LSClient';
import { State } from 'vscode-languageclient';

/**
 * Creates the LSP client item for the environment view.
 *
 * @returns {EnvironmentItem} The LSP client item.
 */
export function createLSClientItem(lsClientStatus: State): EnvironmentItem {
  const statusMappings = {
    [State.Running]: { description: 'Running', icon: 'globe' },
    [State.Starting]: { description: 'Initializing…', icon: 'sync~spin' },
    [State.Stopped]: { description: 'Stopped', icon: 'close' },
  };

  const { description, icon } = statusMappings[lsClientStatus];

  return new EnvironmentItem(
    'LSP Client',
    description,
    TreeItemCollapsibleState.None,
    icon,
    'lsClient'
  );
}

/**
 * Creates the ZenML status items for the environment view.
 *
 * @returns {Promise<EnvironmentItem[]>} The ZenML status items.
 */
export async function createZenMLStatusItems(): Promise<EnvironmentItem[]> {
  const zenmlReady = LSClient.getInstance().isZenMLReady;
  const localZenML = LSClient.getInstance().localZenML;

  const zenMLLocalInstallationItem = new EnvironmentItem(
    'ZenML Local',
    localZenML.is_installed ? `${localZenML.version}` : 'Not found',
    TreeItemCollapsibleState.None,
    localZenML.is_installed ? 'check' : 'warning'
  );

  const zenMLClientStatusItem = new EnvironmentItem(
    'ZenML Client',
    !localZenML.is_installed ? '' : zenmlReady ? 'Initialized' : 'Awaiting Initialization',
    TreeItemCollapsibleState.None,
    !localZenML.is_installed ? 'error' : zenmlReady ? 'check' : 'sync~spin'
  );

  return [zenMLLocalInstallationItem, zenMLClientStatusItem];
}

/**
 * Creates the workspace settings items for the environment view.
 *
 * @returns {Promise<EnvironmentItem[]>} The workspace settings items.
 */
export async function createWorkspaceSettingsItems(): Promise<EnvironmentItem[]> {
  const settings = await getWorkspaceSettings(PYTOOL_MODULE, await getProjectRoot(), true);

  return [
    new EnvironmentItem('CWD', settings.cwd),
    new EnvironmentItem('File System', settings.workspace),
    ...(settings.path && settings.path.length
      ? [new EnvironmentItem('Path', settings.path.join('; '))]
      : []),
  ];
}

/**
 * Creates the interpreter details items for the environment view.
 *
 * @returns {Promise<EnvironmentItem[]>} The interpreter details items.
 */
export async function createInterpreterDetails(): Promise<EnvironmentItem[]> {
  const interpreterDetails = await getInterpreterDetails();
  const interpreterPath = interpreterDetails.path?.[0];
  if (!interpreterPath) {
    return [];
  }

  const resolvedEnv = await resolveInterpreter([interpreterPath]);
  if (!resolvedEnv) {
    return [
      new EnvironmentItem(
        'Details',
        'Could not resolve environment details',
        TreeItemCollapsibleState.None
      ),
    ];
  }
  const pythonVersion = `${resolvedEnv.version?.major}.${resolvedEnv.version?.minor}.${resolvedEnv.version?.micro}`;
  const simplifiedPath = simplifyPath(resolvedEnv.path);

  return [
    new EnvironmentItem('Python Version', pythonVersion, TreeItemCollapsibleState.None),
    new EnvironmentItem('Name', resolvedEnv?.environment?.name, TreeItemCollapsibleState.None),
    new EnvironmentItem('EnvType', resolvedEnv?.environment?.type, TreeItemCollapsibleState.None),
    new EnvironmentItem('Path', simplifiedPath, TreeItemCollapsibleState.None),
  ];
}

/**
 * Simplifies the path by replacing the home directory with '~'.
 *
 * @param path The path to simplify.
 * @returns {string} The simplified path.
 */
function simplifyPath(path: string): string {
  if (!path) {
    return '';
  }
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    return path.replace(homeDir, '~');
  }
  return path;
}
