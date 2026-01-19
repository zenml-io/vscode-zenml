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

import * as vscode from 'vscode';
import { AnalyticsService } from '../../services/AnalyticsService';
import { getZenMLAnalyticsEnabled, updateZenMLAnalyticsEnabled } from '../../utils/global';

/**
 * Toggle analytics on or off.
 * Shows an informational message about the current state.
 */
const toggleAnalytics = async (): Promise<void> => {
  const currentState = getZenMLAnalyticsEnabled();
  const newState = !currentState;

  await updateZenMLAnalyticsEnabled(newState);

  // Refresh the analytics service enablement
  AnalyticsService.getInstance().refreshEnablement();

  // Check VS Code telemetry state for informative message
  const vscodeTelemetryEnabled =
    typeof vscode.env.isTelemetryEnabled === 'boolean'
      ? vscode.env.isTelemetryEnabled
      : vscode.workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all') !==
        'off';

  if (newState) {
    if (vscodeTelemetryEnabled) {
      vscode.window.showInformationMessage('ZenML Analytics enabled.');
    } else {
      vscode.window.showInformationMessage(
        'ZenML Analytics enabled in settings, but VS Code telemetry is disabled. ' +
          'Enable VS Code telemetry to send analytics.'
      );
    }
  } else {
    vscode.window.showInformationMessage('ZenML Analytics disabled.');
  }
};

export const analyticsCommands = {
  toggleAnalytics,
};
