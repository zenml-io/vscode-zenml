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

import * as vscode from 'vscode';
import WebviewBase from '../../common/WebviewBase';
import { handlebars } from 'hbs';
import Panels from '../../common/panels';
import { Flavor } from '../../types/StackTypes';
import { LSClient } from '../../services/LSClient';
import { traceError, traceInfo } from '../../common/log/logging';

const ROOT_PATH = ['resources', 'components-form'];
const CSS_FILE = 'components.css';
const JS_FILE = 'components.js';

export default class ComponentForm extends WebviewBase {
  private static instance: ComponentForm | null = null;

  private root: vscode.Uri;
  private javaScript: vscode.Uri;
  private css: vscode.Uri;
  private template: HandlebarsTemplateDelegate;

  public static getInstance(): ComponentForm {
    if (!ComponentForm.instance) {
      ComponentForm.instance = new ComponentForm();
    }

    return ComponentForm.instance;
  }

  constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension Context Not Propagated');
    }

    this.root = vscode.Uri.joinPath(WebviewBase.context.extensionUri, ...ROOT_PATH);
    this.javaScript = vscode.Uri.joinPath(this.root, JS_FILE);
    this.css = vscode.Uri.joinPath(this.root, CSS_FILE);

    this.template = handlebars.compile(this.produceTemplate());
  }

  public async createForm(flavor: Flavor) {
    const panel = await this.getPanel();
    panel.webview.html = this.template({
      type: flavor.type,
      flavor: flavor.name,
      description: flavor.config_schema.description,
      docs_url: flavor.docs_url,
      sdk_docs_url: flavor.sdk_docs_url,
      js: panel.webview.asWebviewUri(this.javaScript),
      css: panel.webview.asWebviewUri(this.css),
    });
  }

  private async getPanel(): Promise<vscode.WebviewPanel> {
    const panels = Panels.getInstance();
    const existingPanel = panels.getPanel('stack-form');
    if (existingPanel) {
      existingPanel.reveal();
      return existingPanel;
    }

    const panel = panels.createPanel('stack-form', 'Stack Form', {
      enableForms: true,
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    this.attachListener(panel);
    return panel;
  }

  private attachListener(panel: vscode.WebviewPanel) {}

  private produceTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Secuirty-Policy" content="default-src 'none';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="{{css}}">
    <title>Stack Form</title>
  </head>
  <body>
    <h2>Create {{type}} Stack Component ({{flavor}})</h2>
    <div class="block">
      <article class="description">{{description}}</article>
      <div class="docs">
        {{#if docs_url}}
          <a class="button" href="{{docs_url}}">Documentation</a>
        {{/if}}

        {{#if sdk_docs_url}}
          <a class="button" href="{{sdk_docs_url}}">SDK Documentation</a>
        {{/if}}
      </div>
    </div>
    <form>
      <label for="name" required><strong>Component Name:</strong></label>
      <input type="text" name="name" id="name">


      
      <div class="center"><input type="submit"></div>
    </form>
    <div class="center"><span class="loader hidden"></span></div>
    <script src="{{js}}"></script>
  </body>
</html>
    `;
  }
}
