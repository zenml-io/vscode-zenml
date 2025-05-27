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

import * as fs from 'fs/promises';
import * as path from 'path';
import { DagConfig } from '../DagConfig';

export class IconLoader {
  private iconSvgs: { [name: string]: string } = {};
  private config: DagConfig;

  constructor(config: DagConfig) {
    this.config = config;
  }

  /**
   * Dynamically loads all SVG icons from the icons directory
   */
  async loadIcons(basePath: string): Promise<{ [name: string]: string }> {
    // Always use the semantic mapping to ensure consistency
    await this.loadIconsManually(basePath);

    return this.iconSvgs;
  }

  /**
   * Fallback method using the original manual icon mapping
   */
  private async loadIconsManually(basePath: string): Promise<void> {
    const iconPath = path.join(basePath, this.config.paths.iconsDirectory.replace(/^\//, ''));

    const loadPromises = Object.entries(this.config.icons).map(async ([semanticName, fileName]) => {
      try {
        const filePath = path.join(iconPath, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        this.iconSvgs[semanticName] = content;
      } catch (error) {
        this.iconSvgs[semanticName] = '';
        console.error(`✗ Failed to load ${semanticName} from ${fileName}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Gets the loaded icons
   */
  getIcons(): { [name: string]: string } {
    return this.iconSvgs;
  }
}
