# Changelog

All notable changes to the "zenml-vscode" extension will be documented in this file.

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
