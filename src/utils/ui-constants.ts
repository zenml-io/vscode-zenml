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
import { ThemeColor, ThemeIcon } from 'vscode';

/**
 * Theme Colors - Centralized definition of all colors used in the extension
 */
export const ZENML_COLORS = {
  // Primary brand colors
  PRIMARY: new ThemeColor('charts.blue'),

  // Status colors
  SUCCESS: new ThemeColor('charts.green'),
  WARNING: new ThemeColor('charts.yellow'),
  ERROR: new ThemeColor('charts.red'),
  INFO: new ThemeColor('charts.purple'),

  // Secondary colors
  ORANGE: new ThemeColor('charts.orange'),
  PURPLE: new ThemeColor('charts.purple'),

  // UI element colors
  HOVER_BACKGROUND: new ThemeColor('list.hoverBackground'),
  ACTIVE_BACKGROUND: new ThemeColor('list.activeSelectionBackground'),
  FOCUS_BACKGROUND: new ThemeColor('list.focusBackground'),
  BORDER: new ThemeColor('list.dropBackground'),

  // Text colors
  PRIMARY_TEXT: new ThemeColor('foreground'),
  SECONDARY_TEXT: new ThemeColor('descriptionForeground'),
  BADGE_TEXT: new ThemeColor('badge.foreground'),
  BADGE_BACKGROUND: new ThemeColor('badge.background'),
};

/**
 * Tree Icons - Centralized definition of all icons used in tree views
 */
export const TREE_ICONS: Record<string, ThemeIcon> = {
  // Lowercase icon names for direct access by string key
  link: new ThemeIcon('link', new ThemeColor('textLink.foreground')),
  'symbol-variable': new ThemeIcon('symbol-variable'),
  'symbol-method': new ThemeIcon('symbol-method'),
  versions: new ThemeIcon('versions'),
  database: new ThemeIcon('database'),
  rocket: new ThemeIcon('rocket'),
  lock: new ThemeIcon('lock'),
  key: new ThemeIcon('key'),
  account: new ThemeIcon('account'),
  bug: new ThemeIcon('bug'),
  shield: new ThemeIcon('shield'),
  folder: new ThemeIcon('folder'),

  // Uppercase constant names
  // General icons
  REFRESH: new ThemeIcon('refresh'),
  ADD: new ThemeIcon('add'),
  EDIT: new ThemeIcon('edit'),
  DELETE: new ThemeIcon('trash'),
  GLOBE: new ThemeIcon('globe'),
  COPY: new ThemeIcon('copy'),
  LAYERS: new ThemeIcon('layers'),

  // Status icons
  SUCCESS: new ThemeIcon('check', ZENML_COLORS.SUCCESS),
  WARNING: new ThemeIcon('warning', ZENML_COLORS.WARNING),
  ERROR: new ThemeIcon('x', ZENML_COLORS.ERROR),
  LOADING: new ThemeIcon('loading~spin'),
  CLOCK: new ThemeIcon('clock', ZENML_COLORS.ORANGE),
  HISTORY: new ThemeIcon('history', ZENML_COLORS.WARNING),
  RUNNING: new ThemeIcon('sync~spin', ZENML_COLORS.WARNING),
  INITIALIZING: new ThemeIcon('sync~spin', ZENML_COLORS.PURPLE),

  // View-specific icons
  SERVER: new ThemeIcon('vm'),
  SERVER_CONNECTED: new ThemeIcon('vm-active', ZENML_COLORS.SUCCESS),
  SERVER_DISCONNECTED: new ThemeIcon('vm-connect'),
  STACK: new ThemeIcon('layers'),
  ACTIVE_STACK: new ThemeIcon('layers-active', ZENML_COLORS.SUCCESS),
  PROJECT: new ThemeIcon('symbol-method'),
  ACTIVE_PROJECT: new ThemeIcon('symbol-function', ZENML_COLORS.SUCCESS),
  COMPONENT: new ThemeIcon('package'),
  ACTIVE_COMPONENT: new ThemeIcon('package', ZENML_COLORS.SUCCESS),
  COMPONENT_CATEGORY: new ThemeIcon('folder'),
  PIPELINE: new ThemeIcon('symbol-interface'),
  PIPELINE_RUN: new ThemeIcon('beaker'),
  ENVIRONMENT: new ThemeIcon('server-environment'),
  // Model icons
  MODEL: new ThemeIcon('chip', ZENML_COLORS.PURPLE),
  MODEL_VERSION: new ThemeIcon('chip'),
  MODEL_STAGING: new ThemeIcon('chip', ZENML_COLORS.ORANGE),
  MODEL_PRODUCTION: new ThemeIcon('chip', ZENML_COLORS.SUCCESS),
  MODEL_LATEST: new ThemeIcon('chip', ZENML_COLORS.PRIMARY),

  // Detail icons
  DETAIL: new ThemeIcon('symbol-property'),
  FOLDER: new ThemeIcon('folder'),
  VARIABLE: new ThemeIcon('symbol-variable'),
  CONFIG: new ThemeIcon('settings-gear'),
  STEP: new ThemeIcon('debug-step-over'),
  LINK: new ThemeIcon('link', new ThemeColor('textLink.foreground')),
  KEY: new ThemeIcon('key'),
  ACCOUNT: new ThemeIcon('account'),
  BUG: new ThemeIcon('bug'),
  SHIELD: new ThemeIcon('shield'),
  DATABASE: new ThemeIcon('database'),
  ROCKET: new ThemeIcon('rocket'),
  VERSIONS: new ThemeIcon('versions'),
  LOCK: new ThemeIcon('lock'),
  TAG: new ThemeIcon('tag'),
  METADATA: new ThemeIcon('graph'),

  // Action icons
  DAG: new ThemeIcon('type-hierarchy'),
  INFO: new ThemeIcon('info'),
  SET_ACTIVE: new ThemeIcon('check'),
  SWITCH: new ThemeIcon('arrow-swap'),
  RESTART: new ThemeIcon('debug-restart'),
};

/**
 * Pipeline Run Status Icons - Icons for different pipeline run statuses
 */
export const PIPELINE_RUN_STATUS_ICONS: Record<string, ThemeIcon> = {
  initializing: TREE_ICONS.INITIALIZING,
  failed: TREE_ICONS.ERROR,
  completed: TREE_ICONS.SUCCESS,
  running: TREE_ICONS.RUNNING,
  cached: TREE_ICONS.HISTORY,
};

/**
 * Model Version Status Icons - Icons for different model version statuses
 */
export const MODEL_VERSION_STATUS_ICONS: Record<string, ThemeIcon> = {
  production: TREE_ICONS.MODEL_PRODUCTION,
  staging: TREE_ICONS.MODEL_STAGING,
  archived: TREE_ICONS.MODEL_VERSION,
  latest: TREE_ICONS.MODEL_LATEST,
};

export const MODEL_VERSION_SECTION_ICONS: Record<string, ThemeIcon> = {
  tags: TREE_ICONS.TAG,
  data_artifacts: TREE_ICONS.DATABASE,
  model_artifacts: TREE_ICONS.DATABASE,
  pipeline_runs: TREE_ICONS.PIPELINE_RUN,
  run_metadata: TREE_ICONS.METADATA,
};

/**
 * Tooltip Formatters - Functions to format tooltips consistently
 */
export const TOOLTIPS = {
  formatStack: (name: string, id: string, isActive: boolean) => {
    return new ThemeIcon(`**Stack: ${name}**\n\nActive: ${isActive ? 'Yes' : 'No'}`);
  },

  formatProject: (name: string, id: string, isActive: boolean) => {
    return new ThemeIcon(`**Project: ${name}**\n\nActive: ${isActive ? 'Yes' : 'No'}`);
  },

  formatComponent: (name: string, type: string, flavor: string) => {
    return new ThemeIcon(`**Component: ${name}**\n\n**Type:** ${type}\n\n**Flavor:** ${flavor}`);
  },

  formatPipelineRun: (name: string, status: string) => {
    return new ThemeIcon(`**Pipeline Run: ${name}**\n\n**Status:** ${status}`);
  },
};

/**
 * Context Value Constants - Used for context menus in tree views
 */
export const CONTEXT_VALUES = {
  // Container context values
  PROJECT: 'project',
  ACTIVE_PROJECT: 'activeProject',
  // Stack context values
  STACK: 'stack',
  ACTIVE_STACK: 'activeStack',
  // Stack component context values
  STACK_COMPONENT: 'stackComponent',
  ACTIVE_STACK_COMPONENT: 'activeStackComponent',
  COMPONENT: 'component',
  COMPONENT_CATEGORY: 'componentCategory',
  // Pipeline context values
  PIPELINE: 'pipeline',
  PIPELINE_RUN: 'pipelineRun',
  NO_RUNS: 'noRuns',
  // Model registry context values
  MODEL: 'model',
  MODEL_VERSION: 'modelVersion',
  MODEL_DETAIL: 'modelDetail',
  MODEL_SECTION: 'modelSection',

  // Detail context values
  PROJECT_DETAIL: 'projectDetail',
  COMPONENT_DETAIL: 'componentDetail',
  PIPELINE_RUN_DETAIL: 'pipelineRunDetail',

  // Environment context values
  INTERPRETER: 'interpreter',
};

/**
 * Tree Item Collapsible States
 * A convenience wrapper around the VS Code collapsible states
 */
export const TREE_ITEM_STATE = {
  NONE: 0, // TreeItemCollapsibleState.None
  COLLAPSED: 1, // TreeItemCollapsibleState.Collapsed
  EXPANDED: 2, // TreeItemCollapsibleState.Expanded
};
