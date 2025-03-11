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

import { Flavor } from '../types/StackTypes';

/**
 * Format flavor information into a nicely formatted markdown string for tooltips
 */
export function formatFlavorTooltip(flavor: Flavor | string): string {
  if (!flavor) {
    return '';
  }

  if (typeof flavor === 'string') {
    return flavor;
  }

  const lines = [];

  if (flavor.name) {
    lines.push(`&nbsp;&nbsp;name: ${flavor.name}`);
  }

  if (flavor.body?.integration) {
    lines.push(`&nbsp;&nbsp;integration: ${flavor.body.integration}`);
  }

  if (flavor.type) {
    lines.push(`&nbsp;&nbsp;type: ${flavor.type}`);
  }

  const created = flavor.created || flavor.body?.created;
  if (created) {
    lines.push(`&nbsp;&nbsp;created: ${created}`);
  }

  const updated = flavor.updated || flavor.body?.updated;
  if (updated) {
    lines.push(`&nbsp;&nbsp;updated: ${updated}`);
  }

  const sourceFromConfigSchema = flavor.config_schema?.title;
  const sourceFromBody = flavor.body?.source?.split('.').pop() || flavor.body?.source;
  const source = sourceFromConfigSchema || sourceFromBody;

  if (source) {
    lines.push(`&nbsp;&nbsp;source: ${source}`);
  }

  // Join with line breaks + spaces for proper markdown rendering
  return lines.join('  \n');
}
