# Changelog

All notable changes to the "zenml-vscode" extension will be documented in this file.

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
