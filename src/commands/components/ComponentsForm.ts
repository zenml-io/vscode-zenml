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
import { ComponentDataProvider } from '../../views/activityBar/componentView/ComponentDataProvider';

const ROOT_PATH = ['resources', 'components-form'];
const CSS_FILE = 'components.css';
const JS_FILE = 'components.js';

interface ComponentField {
  is_string?: boolean;
  is_integer?: boolean;
  is_boolean?: boolean;
  is_string_object?: boolean;
  is_json_object?: boolean;
  is_array?: boolean;
  is_optional?: boolean;
  is_required?: boolean;
  defaultValue: any;
  title: string;
  key: string;
}

export default class ComponentForm extends WebviewBase {
  private static instance: ComponentForm | null = null;

  private root: vscode.Uri;
  private javaScript: vscode.Uri;
  private css: vscode.Uri;
  private template: HandlebarsTemplateDelegate;

  /**
   * Retrieves a singleton instance of ComponentForm
   * @returns {ComponentForm} The singleton instance
   */
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

  /**
   * Opens a webview panel based on the flavor config schema to create a new
   * component
   * @param {Flavor} flavor Flavor of component to create
   */
  public async createForm(flavor: Flavor) {
    const panel = await this.getPanel();
    const description = flavor.config_schema.description.replaceAll('\n', '<br>');
    panel.webview.html = this.template({
      type: flavor.type,
      flavor: flavor.name,
      logo: flavor.logo_url,
      description,
      docs_url: flavor.docs_url,
      sdk_docs_url: flavor.sdk_docs_url,
      js: panel.webview.asWebviewUri(this.javaScript),
      css: panel.webview.asWebviewUri(this.css),
      fields: this.toFormFields(flavor.config_schema),
    });

    panel.webview.postMessage({ command: 'create', type: flavor.type, flavor: flavor.name });
  }

  /**
   * Opens a webview panel based on the flavor config schema to update a
   * specified component
   * @param {Flavor} flavor Flavor of the selected component
   * @param {string} name Name of the selected component
   * @param {string} id ID of the selected component
   * @param {object} config Current configuration settings of the selected
   * component
   */
  public async updateForm(
    flavor: Flavor,
    name: string,
    id: string,
    config: { [key: string]: any }
  ) {
    const panel = await this.getPanel();
    const description = flavor.config_schema.description.replaceAll('\n', '<br>');
    panel.webview.html = this.template({
      type: flavor.type,
      flavor: flavor.name,
      logo: flavor.logo_url,
      description,
      docs_url: flavor.docs_url,
      sdk_docs_url: flavor.sdk_docs_url,
      js: panel.webview.asWebviewUri(this.javaScript),
      css: panel.webview.asWebviewUri(this.css),
      fields: this.toFormFields(flavor.config_schema),
    });

    panel.webview.postMessage({
      command: 'update',
      type: flavor.type,
      flavor: flavor.name,
      name,
      id,
      config,
    });
  }

  private async getPanel(): Promise<vscode.WebviewPanel> {
    const panels = Panels.getInstance();
    const existingPanel = panels.getPanel('component-form', true);
    if (existingPanel) {
      existingPanel.reveal();
      return existingPanel;
    }

    const panel = panels.createPanel('component-form', 'Component Form', {
      enableForms: true,
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    this.attachListener(panel);
    return panel;
  }

  private attachListener(panel: vscode.WebviewPanel) {
    panel.webview.onDidReceiveMessage(
      async (message: { command: string; data: { [key: string]: string } }) => {
        let success = false;
        const data = message.data;
        const { name, flavor, type, id } = data;
        delete data.name;
        delete data.type;
        delete data.flavor;
        delete data.id;

        switch (message.command) {
          case 'create':
            success = await this.createComponent(name, type, flavor, data);
            break;
          case 'update':
            success = await this.updateComponent(id, name, type, data);
            break;
        }

        if (!success) {
          panel.webview.postMessage({ command: 'fail' });
          return;
        }

        panel.dispose();
        ComponentDataProvider.getInstance().refresh();
      }
    );
  }

  private async createComponent(
    name: string,
    type: string,
    flavor: string,
    data: object
  ): Promise<boolean> {
    const lsClient = LSClient.getInstance();
    try {
      const resp = await lsClient.sendLsClientRequest('createComponent', [
        type,
        flavor,
        name,
        data,
      ]);

      if ('error' in resp) {
        vscode.window.showErrorMessage(`Unable to create component: "${resp.error}"`);
        console.error(resp.error);
        traceError(resp.error);
        return false;
      }

      traceInfo(resp.message);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to create component: "${e}"`);
      console.error(e);
      traceError(e);
      return false;
    }

    return true;
  }

  private async updateComponent(
    id: string,
    name: string,
    type: string,
    data: object
  ): Promise<boolean> {
    const lsClient = LSClient.getInstance();
    try {
      const resp = await lsClient.sendLsClientRequest('updateComponent', [id, type, name, data]);

      if ('error' in resp) {
        vscode.window.showErrorMessage(`Unable to update component: "${resp.error}"`);
        console.error(resp.error);
        traceError(resp.error);
        return false;
      }

      traceInfo(resp.message);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to update component: "${e}"`);
      console.error(e);
      traceError(e);
      return false;
    }

    return true;
  }

  private toFormFields(configSchema: { [key: string]: any }) {
    const properties = configSchema.properties;
    const required = configSchema.required ?? [];

    const converted: Array<ComponentField> = [];
    for (const key in properties) {
      const current: ComponentField = {
        key,
        title: properties[key].title,
        defaultValue: properties[key].default,
      };
      converted.push(current);

      if ('anyOf' in properties[key]) {
        if (properties[key].anyOf.find((obj: { type: string }) => obj.type === 'null')) {
          current.is_optional = true;
        }

        if (
          properties[key].anyOf.find(
            (obj: { type: string }) => obj.type === 'object' || obj.type === 'array'
          )
        ) {
          current.is_json_object = true;
        } else if (properties[key].anyOf[0].type === 'string') {
          current.is_string = true;
        } else if (properties[key].anyOf[0].type === 'integer') {
          current.is_integer = true;
        } else if (properties[key].anyOf[0].type === 'boolean') {
          current.is_boolean = true;
        }
      }

      if (required.includes(key)) {
        current.is_required = true;
      }

      if (!properties[key].type) {
        continue;
      }

      current.is_boolean = properties[key].type === 'boolean';
      current.is_string = properties[key].type === 'string';
      current.is_integer = properties[key].type === 'integer';
      if (properties[key].type === 'object' || properties[key].type === 'array') {
        current.is_json_object = true;
        current.defaultValue = JSON.stringify(properties[key].default);
      }

      if (properties[key].type === 'array') {
        current.is_array = true;
      }
    }

    return converted;
  }

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
    <div class="container">
      <h2>Create {{type}} Stack Component ({{flavor}})</h2>
      
      <div class="block">
        <article class="description"><img class="logo" src="{{logo}}">{{{description}}}</article>
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
        <div class="field">
          <div class="label">
            <label for="name"><strong>Component Name*</strong></label>
          </div>
          <div class="value">
            <input type="text" name="name" id="name" required>
          </div>
        </div>

        {{#each fields}}
          <div class="field">
            <div class="label">
              <label for="{{key}}">
                <strong>{{title}} {{#if is_required}}*{{/if}}</strong>
              </label>
              {{#if is_optional}}
                <button class="optional" data-id="{{key}}">+</button>
              {{/if}}
            </div>

            <div class="value">
              {{#if is_string}}
                <input 
                  type="text" 
                  id="{{key}}" 
                  name="{{key}}" 
                  value="{{defaultValue}}"
                  class="input {{#if is_optional}}hidden{{/if}}"
                  {{#if is_required}}required{{/if}} 
                >
              {{/if}}

              {{#if is_boolean}}
                <input
                  type="checkbox"
                  name="{{key}}"
                  id="{{key}}"
                  class="input {{#if is_optional}}hidden{{/if}}"
                  {{#if is_required}}required{{/if}}
                  {{#if defaultValue}}checked{{/if}}
                >
              {{/if}}

              {{#if is_integer}}
                <input
                  type="number"
                  name="{{key}}"
                  id="{{key}}"
                  value="{{default_value}}"
                  class="input {{#if is_optional}}hidden{{/if}}"
                  {{#if is_required}}required{{/if}}
                >
              {{/if}}

              {{#if is_json_object}}
                <textarea 
                  id={{key}}
                  name="{{key}}"
                  class="input {{#if is_optional}}hidden{{/if}}"
                  {{#if is_array}}data-array="array"{{/if}}
                  {{#if is_required}}required{{/if}}
                  placeholder="Please input proper JSON"
                >{{defaultValue}}</textarea>
              {{/if}}
            </div>
          </div>
        {{/each}}
        <div class="center"><input type="submit"></div>
      </form>
      <div class="center"><span class="loader hidden"></span></div>
    </div>
    <script src="{{js}}"></script>
  </body>
</html>
    `;
  }
}
