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
import { State } from 'vscode-languageclient';
import { getActiveProjectNameFromConfig } from '../../../commands/projects/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import {
  Model,
  ModelsResponse,
  ModelVersion,
  ModelVersionsResponse,
} from '../../../types/ModelTypes';
import {
  LSCLIENT_STATE_CHANGED,
  LSP_ZENML_CLIENT_INITIALIZED,
  LSP_ZENML_PROJECT_CHANGED,
} from '../../../utils/constants';
import {
  createAuthErrorItem,
  createErrorItem,
  createServicesNotAvailableItem,
  ErrorTreeItem,
} from '../common/ErrorTreeItem';
import { LOADING_TREE_ITEMS } from '../common/LoadingTreeItem';
import { PaginatedDataProvider } from '../common/PaginatedDataProvider';
import {
  ModelDetailTreeItem,
  ModelSectionTreeItem,
  ModelTreeItem,
  ModelVersionTreeItem,
} from './ModelTreeItems';

/**
 * Provides data for the models tree view, displaying models and their versions.
 */
export class ModelDataProvider extends PaginatedDataProvider {
  private static instance: ModelDataProvider | null = null;
  private activeProjectName: string | undefined;
  private eventBus = EventBus.getInstance();
  private zenmlClientReady = false;
  private lsClientReady = false;
  private modelVersionsCache: Map<string, ModelVersion[]> = new Map();

  constructor() {
    super();
    this.items = [LOADING_TREE_ITEMS.get('models')!];
    this.viewName = 'Model';
    this.subscribeToEvents();
  }

  /**
   * Retrieves the singleton instance of ModelDataProvider.
   *
   * @returns {ModelDataProvider} The singleton instance.
   */
  public static getInstance(): ModelDataProvider {
    if (!ModelDataProvider.instance) {
      ModelDataProvider.instance = new ModelDataProvider();
    }
    return ModelDataProvider.instance;
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the tree view.
   */
  public subscribeToEvents(): void {
    this.eventBus.off(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.off(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);

    this.eventBus.on(LSCLIENT_STATE_CHANGED, this.lsClientStateChangeHandler);
    this.eventBus.on(LSP_ZENML_CLIENT_INITIALIZED, this.zenmlClientStateChangeHandler);
  }

  /**
   * Handles the change in the LSP client state.
   *
   * @param {State} status The new LSP client state.
   */
  private lsClientStateChangeHandler = (status: State) => {
    if (status !== State.Running) {
      this.lsClientReady = false;
      this.items = [createServicesNotAvailableItem()];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.lsClientReady = true;
      this.refresh();
    }
  };

  /**
   * Handles the change in the ZenML client state.
   *
   * @param {boolean} isInitialized The new ZenML client state.
   */
  private zenmlClientStateChangeHandler = (isInitialized: boolean) => {
    this.zenmlClientReady = isInitialized;
    if (!isInitialized) {
      this.items = [LOADING_TREE_ITEMS.get('models')!];
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.refresh();

      this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
      this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    }
  };

  /**
   * Handles the change in the project.
   *
   * @param {string} projectName The new project name.
   */
  private projectChangeHandler = (projectName?: string) => {
    if (projectName && projectName !== this.activeProjectName) {
      this.activeProjectName = projectName;
      this.modelVersionsCache.clear(); // Clear cache when project changes
      this.refresh(projectName);
    }
  };

  /**
   * Gets the model versions for a specific model.
   *
   * @param {string} modelId The model ID.
   * @returns {Promise<ModelVersion[]>} The model versions.
   */
  public async getModelVersions(modelId: string): Promise<ModelVersion[]> {
    // Check if we have the versions in the cache
    if (this.modelVersionsCache.has(modelId)) {
      return this.modelVersionsCache.get(modelId)!;
    }

    // If not, fetch them from the server
    try {
      const result = await this.getModelVersionsData(modelId);
      if (Array.isArray(result) && result.length > 0 && 'error' in result[0]) {
        return [];
      }

      if ('items' in result) {
        // Store in cache
        this.modelVersionsCache.set(modelId, result.items);
        return result.items;
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch model versions: ${error}`);
      return [];
    }
  }

  /**
   * Refreshes the "Models" view by fetching the latest model data and updating the view.
   *
   * @param {string} projectName - (Optional) The name of the project to fetch models for.
   * @returns A promise resolving to void.
   */
  public async refresh(projectName?: string): Promise<void> {
    this.items = [LOADING_TREE_ITEMS.get('models')!];
    this._onDidChangeTreeData.fire(undefined);
    const page = this.pagination.currentPage;
    const itemsPerPage = this.pagination.itemsPerPage;

    if (!this.activeProjectName && !projectName) {
      const activeProjectName = getActiveProjectNameFromConfig();
      this.activeProjectName = activeProjectName;
    }

    try {
      const newModelsData = await this.fetchModels(page, itemsPerPage, projectName);
      this.items = newModelsData;
    } catch (error: any) {
      this.items = createErrorItem(error);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Fetches models from the server and maps them to tree items for display.
   *
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - (Optional) The name of the project to fetch models for.
   * @returns {Promise<vscode.TreeItem[]>} A promise resolving to an array of TreeItems.
   */
  private async fetchModels(
    page: number = 1,
    itemsPerPage: number = 20,
    projectName?: string
  ): Promise<vscode.TreeItem[]> {
    if (!this.lsClientReady || !this.zenmlClientReady) {
      return [createServicesNotAvailableItem()];
    }

    try {
      const result = await this.getModelsData(page, itemsPerPage, projectName);

      if (this.isErrorResponse(result)) {
        return this.handleErrorResponse(result);
      }

      if ('items' in result) {
        this.updatePagination(result);

        if (result.items.length === 0) {
          return this.createNoModelsFoundItem();
        }

        return this.createModelTreeItems(result.items);
      } else {
        console.error(`Unexpected response format:`, result);
        return [];
      }
    } catch (error: any) {
      console.error(`Failed to fetch models: ${error}`);
      return [
        new ErrorTreeItem('Error', `Failed to fetch models: ${error.message || error.toString()}`),
      ];
    }
  }

  /**
   * Fetches models data from the server.
   *
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - The name of the project to fetch models for.
   * @returns {Promise<ModelsResponse>} A promise resolving to the models data.
   */
  private async getModelsData(
    page: number,
    itemsPerPage: number,
    projectName?: string
  ): Promise<ModelsResponse> {
    const lsClient = LSClient.getInstance();
    return await lsClient.sendLsClientRequest<ModelsResponse>(`listModels`, [
      page,
      itemsPerPage,
      projectName,
    ]);
  }

  /**
   * Fetches model versions data from the server for a specific model.
   *
   * @param {string} modelId - The model ID to fetch versions for.
   * @param {number} page - The page number to fetch.
   * @param {number} itemsPerPage - The number of items per page.
   * @param {string} projectName - (Optional) The name of the project to fetch versions for.
   * @returns {Promise<ModelVersionsResponse>} A promise resolving to the model versions data.
   */
  private async getModelVersionsData(
    modelId: string,
    page: number = 1,
    itemsPerPage: number = 10,
    projectName?: string
  ): Promise<ModelVersionsResponse> {
    const lsClient = LSClient.getInstance();
    return await lsClient.sendLsClientRequest<ModelVersionsResponse>(`listModelVersions`, [
      modelId,
      page,
      itemsPerPage,
      projectName,
    ]);
  }

  /**
   * Creates tree items for each model.
   *
   * @param {Model[]} models - The models to create tree items for.
   * @returns {vscode.TreeItem[]} An array of tree items.
   */
  private createModelTreeItems(models: Model[]): vscode.TreeItem[] {
    return models.map(model => {
      const description = model.latest_version_name ? `Latest: ${model.latest_version_name}` : '';

      const modelItem = new ModelTreeItem(model, model.id || model.name, description);

      return modelItem;
    });
  }

  /**
   * Gets the children for a tree item.
   *
   * @param {vscode.TreeItem} element - The tree item to get children for.
   * @returns {Promise<vscode.TreeItem[]>} A promise resolving to an array of tree items.
   */
  public async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // For the root level, use the parent class implementation to properly handle pagination
      return (await super.getChildren()) || [];
    }

    // Handle model tree item to show versions
    if (element instanceof ModelTreeItem) {
      const modelId = element.id;
      const modelVersions = await this.getModelVersions(modelId);

      if (modelVersions.length === 0) {
        return [new vscode.TreeItem('No versions found')];
      }

      // Sort versions by number in descending order (newest first)
      const sortedVersions = [...modelVersions].sort((a, b) => b.number - a.number);

      return sortedVersions.map(version => new ModelVersionTreeItem(version));
    }

    // Handle model version tree item to show details
    else if (element instanceof ModelVersionTreeItem) {
      const version = element.version;
      const detailItems: vscode.TreeItem[] = [
        new ModelDetailTreeItem('id', version.id),
        new ModelDetailTreeItem('number', version.number.toString()),
        new ModelDetailTreeItem('stage', version.stage || ''),
        new ModelDetailTreeItem('created', new Date(version.created).toLocaleString()),
        new ModelDetailTreeItem('updated', new Date(version.updated).toLocaleString()),
      ];

      // Add tags if present
      if (version.tags && version.tags.length > 0) {
        const tagsSection = new ModelSectionTreeItem('tags');
        tagsSection.children = version.tags.map(tag => new ModelDetailTreeItem(tag.name, ''));
        detailItems.push(tagsSection);
      }

      // Add artifacts if present
      if (version.data_artifact_ids && Object.keys(version.data_artifact_ids).length > 0) {
        const artifactsSection = new ModelSectionTreeItem('data_artifacts');

        // Convert nested object structure to flat items
        const artifactItems: vscode.TreeItem[] = [];

        for (const [artifactName, versionObj] of Object.entries(version.data_artifact_ids)) {
          for (const [versionNum, artifactId] of Object.entries(versionObj)) {
            artifactItems.push(
              new ModelDetailTreeItem(artifactName, `v: ${versionNum}, id: ${artifactId}`)
            );
          }
        }

        artifactsSection.children = artifactItems;
        detailItems.push(artifactsSection);
      }

      // Add model artifacts if present
      if (version.model_artifact_ids && Object.keys(version.model_artifact_ids).length > 0) {
        const modelArtifactsSection = new ModelSectionTreeItem('model_artifacts');

        // Convert nested object structure to flat items
        const artifactItems: vscode.TreeItem[] = [];

        for (const [artifactName, versionObj] of Object.entries(version.model_artifact_ids)) {
          for (const [versionNum, artifactId] of Object.entries(versionObj)) {
            artifactItems.push(
              new ModelDetailTreeItem(artifactName, `v: ${versionNum}, id: ${artifactId}`)
            );
          }
        }

        modelArtifactsSection.children = artifactItems;
        detailItems.push(modelArtifactsSection);
      }

      // Add pipeline runs if present
      if (version.pipeline_run_ids && Object.keys(version.pipeline_run_ids).length > 0) {
        const pipelineRunsSection = new ModelSectionTreeItem('pipeline_runs');

        pipelineRunsSection.children = Object.entries(version.pipeline_run_ids).map(
          ([runName, runId]) => new ModelDetailTreeItem(runName, runId)
        );

        detailItems.push(pipelineRunsSection);
      }

      // Add run metadata if present
      if (version.run_metadata && Object.keys(version.run_metadata).length > 0) {
        detailItems.push(this.createMetadataTreeItems(version.run_metadata));
      }

      return detailItems;
    }

    // Handle section tree items (for grouping details)
    else if (element instanceof ModelSectionTreeItem && element.children) {
      return element.children;
    }

    return [];
  }

  /**
   * Updates pagination based on the response.
   *
   * @param {any} result - The response to update pagination from.
   */
  private updatePagination(result: any): void {
    const { total, total_pages, index, max_size } = result;
    this.pagination = {
      currentPage: index,
      itemsPerPage: max_size,
      totalItems: total,
      totalPages: total_pages,
    };
  }

  /**
   * Creates a TreeItem for when no models are found.
   *
   * @returns {vscode.TreeItem[]} A tree item for when no models are found.
   */
  private createNoModelsFoundItem(): vscode.TreeItem[] {
    const noModelsItem = new vscode.TreeItem('No models found for this project');
    noModelsItem.contextValue = 'noModels';
    noModelsItem.iconPath = new vscode.ThemeIcon('info');
    noModelsItem.tooltip = 'Register a model in this project to see it listed here';
    return [noModelsItem];
  }

  /**
   * Checks if the response is an error.
   *
   * @param {any} result - The response to check.
   * @returns {boolean} True if the response is an error, false otherwise.
   */
  private isErrorResponse(result: any): boolean {
    return (
      (Array.isArray(result) && result.length === 1 && 'error' in result[0]) ||
      !result ||
      'error' in result ||
      ('clientVersion' in result && 'serverVersion' in result)
    );
  }

  /**
   * Creates tree items for metadata objects with proper nesting for complex structures.
   *
   * @param metadata The metadata object to convert to tree items
   * @returns An array of TreeItems representing the metadata
   */
  private createMetadataTreeItems(metadata: Record<string, any>): ModelSectionTreeItem {
    // Use ModelSectionTreeItem instead of ModelDetailTreeItem for the section
    const metadataSection = new ModelSectionTreeItem('run_metadata');
    metadataSection.children = this.processMetadataObject(metadata);
    return metadataSection;
  }

  /**
   * Processes a metadata object into tree items
   *
   * @param obj The object to process
   * @returns Array of tree items
   */
  private processMetadataObject(obj: any): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        // Handle null/undefined
        items.push(new ModelDetailTreeItem(key, 'null'));
      } else if (Array.isArray(value)) {
        // Handle arrays
        const arraySection = new ModelSectionTreeItem(key);

        if (value.length === 0) {
          arraySection.children = [new ModelDetailTreeItem('empty', '[]')];
        } else {
          arraySection.children = value.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // For object elements in arrays
              const subSection = new ModelSectionTreeItem(`[${index}]`);
              subSection.children = this.processMetadataObject(item);
              return subSection;
            } else {
              // For primitive elements in arrays
              return new ModelDetailTreeItem(`[${index}]`, String(item));
            }
          });
        }

        items.push(arraySection);
      } else if (typeof value === 'object') {
        // Handle objects
        const objectSection = new ModelSectionTreeItem(key);
        objectSection.children = this.processMetadataObject(value);
        items.push(objectSection);
      } else {
        // Handle primitives
        items.push(new ModelDetailTreeItem(key, String(value)));
      }
    }

    return items;
  }

  /**
   * Handles error responses from the server.
   *
   * @param {any} result - The response to handle.
   * @returns {vscode.TreeItem[]} A tree item for the error.
   */
  private handleErrorResponse(result: any): vscode.TreeItem[] {
    if (Array.isArray(result) && result.length === 1 && 'error' in result[0]) {
      const errorMessage = result[0].error;
      if (errorMessage.includes('Authentication error')) {
        return createAuthErrorItem(errorMessage);
      }
      return createErrorItem({
        errorType: errorMessage.includes('Not authorized') ? 'AuthorizationException' : 'Error',
        message: errorMessage,
      });
    }

    if (!result || 'error' in result) {
      if (result?.message?.includes('No project')) {
        return createErrorItem({
          errorType: 'RuntimeError',
          message: 'No project found. Register a project to see models listed here.',
        });
      }
      if ('clientVersion' in result && 'serverVersion' in result) {
        return createErrorItem(result);
      }
      if (result.error.includes('Not authorized')) {
        return createErrorItem({
          errorType: 'AuthorizationException',
          message: result.error,
        });
      }
    }

    return createErrorItem({ message: 'Unknown error occurred' });
  }
}
