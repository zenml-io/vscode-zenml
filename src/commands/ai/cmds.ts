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

import { SaveAIChangeEmitter } from '../pipelines/StepFixerFs';

import * as vscode from 'vscode';
import AIStepFixer from '../pipelines/AIStepFixer';

const displayNextCodeRecommendation = () => {
  let uri = vscode.window.activeTextEditor?.document.uri;
  if (!uri) {
    return;
  }

  const stepFixer = AIStepFixer.getInstance();
  stepFixer.updateCodeRecommendation(uri);
};

const acceptCodeRecommendation = () => {
  let doc = vscode.window.activeTextEditor?.document;
  console.log(doc?.fileName, doc?.uri.scheme);
  if (doc) {
    SaveAIChangeEmitter.fire(doc);
  }
};

export const aiCommands = {
  displayNextCodeRecommendation,
  acceptCodeRecommendation,
};
