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
import { LanguageStatusItem, Disposable, l10n, LanguageStatusSeverity } from 'vscode';
import { createLanguageStatusItem } from './vscodeapi';
import { Command } from 'vscode-languageclient';
import { getDocumentSelector } from './utilities';

let _status: LanguageStatusItem | undefined;
export function registerLanguageStatusItem(id: string, name: string, command: string): Disposable {
  _status = createLanguageStatusItem(id, getDocumentSelector());
  _status.name = name;
  _status.text = name;
  _status.command = Command.create(l10n.t('Open logs'), command);

  return {
    dispose: () => {
      _status?.dispose();
      _status = undefined;
    },
  };
}

export function updateStatus(
  status: string | undefined,
  severity: LanguageStatusSeverity,
  busy?: boolean,
  detail?: string
): void {
  if (_status) {
    _status.text = status && status.length > 0 ? `${_status.name}: ${status}` : `${_status.name}`;
    _status.severity = severity;
    _status.busy = busy ?? false;
    _status.detail = detail;
  }
}
