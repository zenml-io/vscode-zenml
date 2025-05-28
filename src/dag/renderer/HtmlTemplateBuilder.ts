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

export interface BaseTemplateOptions {
  cssUri: vscode.Uri;
  jsUri: vscode.Uri;
  cspSource: string;
}

export interface MainContentOptions extends BaseTemplateOptions {
  svg: string;
  updateButton: boolean;
  title: string;
}

export interface ErrorContentOptions extends BaseTemplateOptions {
  errorMessage: string;
  pipelineName: string;
}

export interface NoStepsContentOptions extends BaseTemplateOptions {
  message: string;
  pipelineName: string;
  status: string;
}

export interface LoadingContentOptions extends BaseTemplateOptions {
  pipelineName: string;
}

export class HtmlTemplateBuilder {
  /**
   * Escapes HTML characters to prevent XSS
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Builds the base HTML structure with common head elements
   */
  private static buildBaseTemplate({
    cssUri,
    jsUri,
    cspSource,
    title,
    bodyContent,
    additionalScripts = '',
  }: {
    cssUri: vscode.Uri;
    jsUri: vscode.Uri;
    cspSource: string;
    title: string;
    bodyContent: string;
    additionalScripts?: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource};">
    <link rel="stylesheet" href="${cssUri}">
    <title>${title}</title>
</head>
<body>
    ${bodyContent}
    <script src="${jsUri}"></script>
    ${additionalScripts}
</body>
</html>`;
  }

  /**
   * Builds the retry button section used in error and no-steps templates
   */
  private static buildRetrySection(pipelineName: string, status?: string): string {
    const escapedPipelineName = HtmlTemplateBuilder.escapeHtml(pipelineName);
    const statusText = status ? ` (${HtmlTemplateBuilder.escapeHtml(status)})` : '';

    return `<div id="update">
      <p>${escapedPipelineName}${statusText}</p><button id="retry-button">Retry</button>
    </div>`;
  }

  /**
   * Generates HTML for the main DAG visualization
   */
  static buildMainContent(options: MainContentOptions): string {
    const { svg, cssUri, jsUri, updateButton, title, cspSource } = options;

    const bodyContent = `
    <div id="update" ${updateButton ? 'class="needs-update"' : ''}>
      <p>${title}</p>${updateButton ? '<button>click to update</button>' : ''}
    </div>
  <div id="container">
    ${svg}
  </div>`;

    return HtmlTemplateBuilder.buildBaseTemplate({
      cssUri,
      jsUri,
      cspSource,
      title: 'DAG',
      bodyContent,
    });
  }

  /**
   * Generates HTML for error states
   */
  static buildErrorContent(options: ErrorContentOptions): string {
    const { cssUri, jsUri, errorMessage, pipelineName, cspSource } = options;

    const retrySection = HtmlTemplateBuilder.buildRetrySection(pipelineName);
    const bodyContent = `
    ${retrySection}
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <div class="error-title">Failed to render pipeline DAG</div>
      <div class="error-message">${errorMessage}</div>
      <p>There was an error while trying to get the DAG data from the ZenML server. Please check the logs for more details.</p>
    </div>`;

    const additionalScripts = `
    <script>
      document.getElementById('retry-button').addEventListener('click', () => {
        vscode.postMessage({ command: 'update' });
      });
    </script>`;

    return HtmlTemplateBuilder.buildBaseTemplate({
      cssUri,
      jsUri,
      cspSource,
      title: 'DAG Error',
      bodyContent,
      additionalScripts,
    });
  }

  /**
   * Generates HTML for when no step data is available
   */
  static buildNoStepsContent(options: NoStepsContentOptions): string {
    const { cssUri, jsUri, message, pipelineName, status, cspSource } = options;

    const retrySection = HtmlTemplateBuilder.buildRetrySection(pipelineName, status);
    const escapedMessage = HtmlTemplateBuilder.escapeHtml(message);

    const bodyContent = `
    ${retrySection}
    <div class="error-container">
      <div class="error-icon">ℹ️</div>
      <div class="error-title">DAG visualization not available</div>
      <div class="error-message">${escapedMessage}</div>
      <p>Step data is not included in optimized responses to improve performance. The pipeline run information is still available in the tree view.</p>
    </div>`;

    return HtmlTemplateBuilder.buildBaseTemplate({
      cssUri,
      jsUri,
      cspSource,
      title: 'DAG - No Steps',
      bodyContent,
    });
  }

  /**
   * Generates HTML for loading state
   */
  static buildLoadingContent(options: LoadingContentOptions): string {
    const { cssUri, jsUri, pipelineName, cspSource } = options;

    const escapedPipelineName = HtmlTemplateBuilder.escapeHtml(pipelineName);

    const bodyContent = `
    <div id="update">
      <p>${escapedPipelineName}</p>
    </div>
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-title">Loading DAG visualization...</div>
    </div>`;

    return HtmlTemplateBuilder.buildBaseTemplate({
      cssUri,
      jsUri,
      cspSource,
      title: 'DAG - Loading',
      bodyContent,
    });
  }
}
