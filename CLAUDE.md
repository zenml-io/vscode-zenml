# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZenML Studio is a VS Code extension that integrates the ZenML MLOps framework into Visual Studio Code. It provides pipeline visualization (DAG), stack management, server connections, and environment management through a bundled Python LSP server.

**Requirements**: VS Code ^1.86.0, Python 3.9+, ZenML 0.63.0+

## Common Commands

### Development
```bash
npm install                 # Install Node dependencies
nox --session setup         # Setup dev environment + Python deps
npm run compile             # Compile TypeScript (webpack)
npm run watch               # Watch mode compilation
npm run lint                # ESLint TypeScript files
npm run format              # Prettier formatting
```

### Testing
```bash
npm run test                # Run VS Code integration tests
npm run pretest             # Compile tests + compile + lint (runs before test)
nox --session tests         # Run Python LSP server tests (pytest)
```

### Full Lint (TypeScript + Python)
```bash
./scripts/lint.sh           # Runs ruff, mypy, eslint, and yamlfix
```

### Pre-Commit Checklist
**IMPORTANT**: Always run linting before committing:
```bash
./scripts/lint.sh
```

### Commit & PR Messages
Use plain, human-readable messages without conventional commit prefixes:
- ✅ `Add concurrency rules to CI workflows`
- ✅ `Fix @types/vscode version compatibility`
- ❌ `chore: add concurrency rules to CI workflows`
- ❌ `fix: @types/vscode version compatibility`

Keep messages concise and descriptive of what changed.

### Packaging & Publishing
```bash
npm run vsce-package        # Create zenml.vsix package
npm run deploy              # Publish to VS Code marketplace
nox --session build_package # Full build for publishing
```

### Debug
Press F5 in VS Code to launch extension in debug mode with a new VS Code window.

## Task Tracking

IMPORTANT: Use 'bd' CLI for task tracking (or the built-in plugin).

## Architecture

### Extension Entry Flow
`src/extension.ts` → `ZenExtension.activate()` → Initializes LSP client, views, commands, and event bus.

### Core Services (`src/services/`)
- **ZenExtension.ts**: Main orchestrator for extension lifecycle, views, and settings
- **LSClient.ts**: Language Server Protocol client managing Python server communication
- **EventBus.ts**: Singleton event emitter for inter-component communication

### Command Organization (`src/commands/`)
Commands are grouped by domain (server, stack, components, pipelines, environment). Each domain follows:
- `cmds.ts` - Command implementations
- `registry.ts` - Registration to VS Code and event bus
- `utils.ts` - API calls and helpers

### View Providers (`src/views/`)
Tree views for Activity Bar sections (server, stacks, components, pipelines, environment). Each uses TreeDataProvider pattern with associated TreeItems.

### Python LSP Server (`bundled/tool/`)
- **lsp_server.py**: Main LSP server using pygls
- **zenml_client.py**: ZenML Python client wrapper
- **zen_watcher.py**: File system watchdog for config changes
- **zenml_grapher.py**: DAG/graph generation

### Communication Flow
```
User Action → Command Handler → LSClient request → Python LSP Server → ZenML SDK
                                    ↓
UI Update ← EventBus notification ← LSP notification
```

## Key Patterns

### Singleton Services
```typescript
static getInstance(): ServiceName {
  if (!ServiceName.instance) {
    ServiceName.instance = new ServiceName();
  }
  return ServiceName.instance;
}
```

### Event-Driven Updates
```typescript
eventBus.emit('LSP_ZENML_STACK_CHANGED', data);
eventBus.on('LSP_ZENML_STACK_CHANGED', () => refreshUI());
```

### Context-Based Command Visibility
Commands use VS Code context (`setContext`) to control when they appear in menus. Check `package.json` `when` clauses.

## Important Files

- **package.json**: Extension manifest, commands, views, configuration schema, activation events
- **webpack.config.js**: Two configs - extension bundle and DAG webview bundle
- **tsconfig.json**: Strict mode TypeScript, ES2022 target
- **noxfile.py**: Python build automation (setup, tests, lint, build_package)

## Code Style

- **TypeScript**: ESLint with `@typescript-eslint`, camelCase/PascalCase naming
- **Formatting**: Prettier (100 char width, single quotes, trailing commas)
- **Python**: ruff (linting + formatting), mypy (type checking)

## Settings Namespace

Extension settings use `zenml.` and `zenml-python.` prefixes:
- `zenml.serverUrl` - ZenML server URL
- `zenml.accessToken` - Authentication token
- `zenml.activeStackId` - Current active stack
- `zenml.analyticsEnabled` - Enable/disable extension analytics
- `zenml-python.interpreter` - Python interpreter path

## Analytics

The extension sends anonymous usage analytics to `https://analytics.zenml.io/batch` via the ZenML Analytics Server. See `src/services/AnalyticsService.ts`.

### Local Testing
Use the **"Run Extension (Analytics Debug)"** launch configuration in `.vscode/launch.json`. This sets:
- `ZENML_ANALYTICS_VERBOSE=1` - Detailed console logging
- `ZENML_ANALYTICS_DEBUG=1` - Routes events to dev Segment (not production)

### Verifying Events in Cloud Run Logs
The analytics server runs in a **separate GCP project** (`zenml-analytics-server`), not `zenml-core`:

```bash
# Query VS Code analytics events
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload=~"vscode"' \
  --limit=10 \
  --project=zenml-analytics-server \
  --format="json"

# List all recent analytics requests
gcloud logging read 'resource.type="cloud_run_revision"' \
  --limit=20 \
  --project=zenml-analytics-server \
  --format="table(timestamp,textPayload)"
```

### Event Flow
```
VS Code Extension → POST analytics.zenml.io/batch (Source-Context: vscode)
                  → Cloud Run (zenml-analytics-server project)
                  → Segment (debug=true → dev, debug=false → prod)
                  → Mixpanel
```
