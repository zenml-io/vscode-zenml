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

import { ProgressLocation, commands, window } from 'vscode';
import { getInterpreterFromWorkspaceSettings } from '../../common/settings';
import { PYTOOL_MODULE } from '../../utils/constants';
import { refreshUIComponents } from '../../utils/refresh';

/**
 * Set the Python interpreter for the current workspace.
 * 
 * @returns {Promise<void>} Resolves after refreshing the view.
 */
const setPythonInterpreter = async (): Promise<void> => {
  await window.withProgress(
    {
      location: ProgressLocation.Window,
      title: 'Refreshing server status...',
    },
    async (progress) => {
      progress.report({ increment: 10 });
      const currentInterpreter = await getInterpreterFromWorkspaceSettings();

      await commands.executeCommand('python.setInterpreter');

      const newInterpreter = await getInterpreterFromWorkspaceSettings();

      if (newInterpreter === currentInterpreter) {
        console.log('Interpreter selection unchanged or cancelled. No server restart required.');
        window.showInformationMessage(
          'Interpreter selection unchanged. Restart not required.'
        );
        return;
      }
      progress.report({ increment: 90 });
      console.log('Interpreter selection completed.');
      window.showInformationMessage(
        'ZenML server will restart to apply the new interpreter settings.'
      );
      // await commands.executeCommand(`${PYTOOL_MODULE}.restart`);
      progress.report({ increment: 100 });
    }
  );
};


export const environmentCommands = {
  setPythonInterpreter,
};
