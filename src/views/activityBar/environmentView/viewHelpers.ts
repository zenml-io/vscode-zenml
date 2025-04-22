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
// or implied. See the License for the specific language governing
// permissions and limitations under the License.
import { TreeItemCollapsibleState } from 'vscode';
import { State } from 'vscode-languageclient';
import { getInterpreterDetails, resolveInterpreter } from '../../../common/python';
import { getWorkspaceSettings } from '../../../common/settings';
import { getProjectRoot } from '../../../common/utilities';
import { LSClient } from '../../../services/LSClient';
import { LSNotificationIsZenMLInstalled } from '../../../types/LSNotificationTypes';
import { PYTOOL_MODULE } from '../../../utils/constants';
import { EnvironmentItem } from './EnvironmentItem';

/**
 * Creates the LSP client item for the environment view.
 *
 * @returns {EnvironmentItem} The LSP client item.
 */
export function createLSClientItem(lsClientStatus: State): EnvironmentItem {
  const statusMappings = {
    [State.Running]: { description: 'Running', icon: 'globe' },
    [State.Starting]: { description: 'Starting...', icon: 'sync~spin' },
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
 * @returns {EnvironmentItem} The ZenML status items.
 */
export function createZenMLClientStatusItem(
  zenmlClientReady: boolean,
  lsClientStatus: State
): EnvironmentItem {
  const localZenML = LSClient.getInstance().localZenML;
  const lsClientRunning = lsClientStatus === State.Running;

  const zenMLClientStatusItem = new EnvironmentItem(
    'ZenML Client',
    !lsClientRunning
      ? 'Language server not running'
      : !localZenML.is_installed
        ? ''
        : zenmlClientReady
          ? 'Initialized'
          : 'Awaiting Initialization',
    TreeItemCollapsibleState.None,
    !lsClientRunning
      ? 'close'
      : !localZenML.is_installed
        ? 'warning'
        : zenmlClientReady
          ? 'check'
          : 'sync~spin'
  );

  return zenMLClientStatusItem;
}

/**
 * Creates the ZenML installation item for the environment view.
 *
 * @param installationStatus The installation status of ZenML.
 * @returns {EnvironmentItem} The ZenML installation item.
 */
export function createZenMLInstallationItem(
  installationStatus: LSNotificationIsZenMLInstalled | null,
  lsClientStatus: State
): EnvironmentItem {
  const lsClientRunning = lsClientStatus === State.Running;

  if (!lsClientRunning) {
    return new EnvironmentItem(
      'ZenML Local Installation',
      'Language server not running',
      TreeItemCollapsibleState.None,
      'close'
    );
  }

  if (!installationStatus) {
    return new EnvironmentItem(
      'ZenML Local Installation',
      'Checking...',
      TreeItemCollapsibleState.None,
      'sync~spin'
    );
  }

  const description = installationStatus.is_installed
    ? `Installed (v${installationStatus.version})`
    : 'Not Installed';
  const icon = installationStatus.is_installed ? 'check' : 'warning';

  return new EnvironmentItem(
    'ZenML Local Installation',
    description,
    TreeItemCollapsibleState.None,
    icon
  );
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
    new EnvironmentItem(
      'Python Version',
      pythonVersion,
      TreeItemCollapsibleState.None,
      '',
      'interpreter'
    ),
    new EnvironmentItem(
      'Name',
      resolvedEnv?.environment?.name,
      TreeItemCollapsibleState.None,
      '',
      'interpreter'
    ),
    new EnvironmentItem(
      'EnvType',
      resolvedEnv?.environment?.type,
      TreeItemCollapsibleState.None,
      '',
      'interpreter'
    ),
    new EnvironmentItem('Path', simplifiedPath, TreeItemCollapsibleState.None, '', 'interpreter'),
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
