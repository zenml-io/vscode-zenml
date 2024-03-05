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
import { PipelineDataProvider } from '../../views/activityBar/pipelineView/PipelineDataProvider';
import * as vscode from 'vscode';

/**
 * Triggers a refresh of the pipeline view within the UI components.
 *
 * @param {PipelineDataProvider} pipelineDataProvider Manages and updates the pipeline UI components.
 * @returns {Promise<void>} Resolves after refreshing the view.
 */
export const refreshPipelineView = async (
  pipelineDataProvider: PipelineDataProvider
): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Refreshing server status...',
    },
    async () => {
      await pipelineDataProvider.refresh();
    }
  );
};
