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

export type StepStatus = 'initializing' | 'failed' | 'completed' | 'running' | 'cached';

export class StatusUtils {
  /**
   * Normalizes step status handling both string and object formats
   */
  static normalizeStatus(status: string | { _value_: string } | undefined): string {
    if (!status) {
      return '';
    }

    if (typeof status === 'string') {
      return status;
    }

    if (typeof status === 'object' && '_value_' in status) {
      return status._value_;
    }

    return '';
  }

  /**
   * Checks if a pipeline run status indicates it needs updating
   */
  static shouldShowUpdateButton(status: string): boolean {
    return status === 'running' || status === 'initializing';
  }

  /**
   * Extracts and formats duration from step data
   */
  static extractDuration(stepData: any): string | null {
    if (!stepData.start_time || !stepData.end_time) {
      return null;
    }

    try {
      const startTime = new Date(stepData.start_time);
      const endTime = new Date(stepData.end_time);

      const durationMs = endTime.getTime() - startTime.getTime();
      const durationSeconds = Math.floor(durationMs / 1000);

      return StatusUtils.formatDuration(durationSeconds);
    } catch (error) {
      console.warn('Failed to parse step timestamps:', error);
      return null;
    }
  }

  /**
   * Formats duration in seconds to human-readable format
   */
  static formatDuration(seconds: number): string {
    if (seconds < 1) {
      return '< 1s';
    } else if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) {
        return `${minutes}m`;
      }
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Determines the appropriate icon for a step based on its status
   */
  static getStepIcon(status: string, iconSvgs: { [name: string]: string }): string {
    return iconSvgs[status] || '';
  }

  /**
   * Determines the appropriate icon for an artifact based on its type
   */
  static getArtifactIcon(artifactType: string, iconSvgs: { [name: string]: string }): string {
    if (artifactType === 'ModelArtifact') {
      return iconSvgs.dataflow || '';
    }
    return iconSvgs.database || '';
  }
}
