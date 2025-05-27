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

export interface DagConfig {
  paths: {
    rootPath: string[];
    cssFile: string;
    jsFile: string;
    iconsDirectory: string;
  };
  panZoom: {
    maxZoom: number;
    viewportSizeRatio: number;
  };
  nodes: {
    step: {
      width: number;
      height: number;
    };
    artifact: {
      width: number;
      height: number;
    };
  };
  layout: {
    rankdir: string;
    ranksep: number;
    nodesep: number;
  };
  icons: {
    [key: string]: string;
  };
  doubleClickTimeout: number;
}

export const DEFAULT_DAG_CONFIG: DagConfig = {
  paths: {
    rootPath: ['resources', 'dag-view'],
    cssFile: 'dag.css',
    jsFile: 'dag-packed.js',
    iconsDirectory: '/resources/dag-view/icons/',
  },
  panZoom: {
    maxZoom: 40,
    viewportSizeRatio: 0.95,
  },
  nodes: {
    step: {
      width: 300,
      height: 54,
    },
    artifact: {
      width: 300,
      height: 48,
    },
  },
  layout: {
    rankdir: 'TB',
    ranksep: 35,
    nodesep: 5,
  },
  icons: {
    failed: 'alert.svg',
    completed: 'check.svg',
    cached: 'cached.svg',
    initializing: 'initializing.svg',
    running: 'play.svg',
    database: 'database.svg',
    dataflow: 'dataflow.svg',
  },
  doubleClickTimeout: 500,
};
