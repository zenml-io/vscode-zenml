# Changelog

All notable changes to the "zenml-vscode" extension will be documented in this file.

## [0.0.16] - 2025-04-11

### Changed

- Supports ZenML 0.80.0-0.80.2

### Fixed

- Fixed `AttributeError` when loading pipeline run step data in DAG view
- Fixed `AttributeError` when loading artifact data in DAG view
- Fixed DAG view icons not showing up correctly
- Fixed active stack occasionally being registered twice on refresh
- Solves the "Element with id 'xyz' is already registered" error when refreshing Stacks view

### Dependencies

- Updated dependencies:
  - svgdom (0.1.20 → 0.1.21)
  - @eslint/js (9.22.0 → 9.24.0)
  - @types/node (22.13.10 → 22.14.0)
  - @types/vscode (1.98.0 → 1.99.0)
  - @vscode/vsce (3.3.0 → 3.3.2)
  - eslint (9.22.0 → 9.24.0)
  - eslint-plugin-prettier (5.2.3 → 5.2.6)
  - typescript (5.8.2 → 5.8.3)
  - typescript-eslint (8.27.0 → 8.29.0)

## [0.0.15] - 2025-03-25

### Fixed

- Fixed stuck status bar loading state on startup
- Resolved unhandled promise rejection from concurrent settings updates
- Improved project and stack switching resilience between CLI and extension

### Changed

- Added "No stacks found" message for empty projects
- Active stack now always shows at top regardless of pagination
- Stack Components view shows info message on startup and loads on-demand (manual refresh)
- Auto-refresh stack view when switching projects

## [0.0.14] - 2025-03-24

### Added

- New ui-constants system for centralized theming and icons
- Added new demonstration GIF for the extension
- Added new gif to README with current features and improvements

### Changed

- Refactored project and stack command structure
- Updated view icons across the extension for better visual consistency
- Eliminated unused functions (isLoadingStack, refreshActiveProject/Stack)
- Removed redundant command descriptions from package.nls.json

## [0.0.13] - 2025-03-23

### Added

- Migrated to ZenML v0.80.0 from v0.75.0
- Introduced Project View in the Activity Bar with switching capabilities and context menu
- Added comprehensive project management with commands to set, refresh, and navigate projects
- Added project switching support to the status bar
- Enhanced Pipeline Runs view with steps, configuration, and model tree items

### Fixed

- Url construction for Server & Dashboard, Pipeline Runs, and Stacks
- ANSI color handling in JSON-RPC communications
- Removed extraneous notifications when opening URLs

### Changed

- Improved logo design in Activity Bar
- Adopted ZenML's "Workspace" → "Project" terminology change
- Updated URL structure for ZenML dashboard integration
- Improved view loading performance by cleaning up event listeners
- Enhanced error messaging in tree views

### Dependencies

- Updated ZenML minimum version requirement to 0.80.0
- Downgraded VS Code engine requirement from ^1.98.0 to ^1.93.0 for Cursor IDE compatibility
- Minor version upgrades: axios (1.8.2 to 1.8.4), typescript-eslint (8.26.0 to 8.26.1), and @vscode/vsce (2.19.0 to 2.20.0)

## [0.0.12] - 2025-03-11

### Added

- Stack registration success feedback and improved component visualization
- New serialization tools for ZenML objects with enhanced error handling
- Reorganized component tree view with better grouping and tooltips

### Changed

- Performance optimizations for stack switching and view refreshes
- Migrated Python tooling from multiple tools to Ruff
- Updated ESLint configuration to new flat config system

### Fixed

- Status bar issues including initial loading hang and synchronization problems
- DAG rendering for pipeline runs with proper artifact dictionary processing
- Improved error handling in component processing and DAG webview

### Dependencies

- Updated multiple dependencies to resolve security alerts
- Major version upgrades: eslint (v9), webpack-cli (v6), typescript (v5.8)
- Added support for ZenML versions 0.63.0 to 0.75.0

## [0.0.11] - 2024-05-15

### Added

- LSP server integration via vscode-python-tools-extension
- DAG Visualizer for pipeline runs
- Stack component creation, updates, and deletion capabilities
- Sidebar links to open dashboard for stacks and runs

### Changed

- Pivoted away from FastAPI to direct ZenML library use
- UI Improvements – Status Bar, Icons, and Cancellable Tasks

### Fixed

- LSClient environment reload issues
- Error when retrieving server information
- Fixed compatibility with ZenML 0.63 PipelineRun versions

### Dependencies

- Integrated `mypy` and `yamlfix`
- Fixed Conda dependency resolution
- Added release workflow
- Bumped braces from 3.0.2 to 3.0.3
