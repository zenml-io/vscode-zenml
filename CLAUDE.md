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
**CRITICAL**: Always run the full lint script before committing AND pushing:
```bash
./scripts/lint.sh
```

This runs ruff, mypy, eslint, prettier, and yamlfix. CI will fail if any of these checks fail, so **always run this locally first** to catch issues before pushing. The script will auto-fix many issues (like YAML formatting), so run it, review the changes, then commit.

### Git Workflow
- **Base branch for PRs**: `develop` (not `main`)
- Feature branches should be created from and merged back to `develop`
- `main` is only updated via releases from `develop`

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

### Tree View Data Providers
Data providers in `src/views/activityBar/` follow specific patterns:

**PaginatedDataProvider inheritance**: Most providers extend `PaginatedDataProvider` which handles pagination commands (Next/Previous Page). Don't override `getChildren()` in ways that bypass the parent's `addPaginationCommands()` logic.

**Visibility-aware providers**: Some providers (e.g., `ComponentDataProvider`) implement `setViewVisible()` to manage their own loading lifecycle. `ZenExtension.attachLazyLoadOnVisibility()` detects these and skips the generic refresh to avoid double-loading.

**LSP result handling**: Always check for null/undefined before using the `'in'` operator:
```typescript
// ❌ Bad: 'in' throws TypeError if result is undefined
if (!result || 'error' in result) {
  if ('clientVersion' in result) { ... }  // Crashes when result is undefined
}

// ✅ Good: Separate null check
if (!result) {
  return createErrorItem({ message: 'Empty response' });
}
if ('error' in result) {
  // Safe to use 'in' now
}
```

**Active item state**: When the active stack/project changes to one outside the current page, update provider state, clear the old active item's visual state, and fire the tree change event—even without fetching new data.

### Error Handling
Use `error: unknown` instead of `error: any` in catch blocks, then narrow the type:
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  vscode.window.showErrorMessage(`Failed: ${message}`);
}
```

### HTML Templates (Handlebars)
Templates embedded in TypeScript (e.g., `StackForm.ts`, `ComponentsForm.ts`) have common pitfalls:
- Always quote attribute values: `id="{{key}}"` not `id={{key}}`
- The `required` attribute goes on `<input>`, not `<label>`
- Match variable names exactly: `{{defaultValue}}` not `{{default_value}}`

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

### Analytics Architecture

```
Command modules → trackEvent() → EventBus.emit(ANALYTICS_TRACK) → AnalyticsService.track() → queued batch POST
                                                                         ↑
                                  EventBus.emit(SERVER_STATUS_UPDATED) → handleServerStatusChange()
                                  EventBus.emit(ENVIRONMENT_INFO_UPDATED) → cached env info
                                  EventBus.emit(SERVER_DISCONNECT_REQUESTED) → disconnect intent
```

**Key files:**
- `src/services/AnalyticsService.ts` — Core service: queuing, batching, common properties, connection tracking
- `src/utils/analytics.ts` — Error classification utility (privacy-safe taxonomy + hashing)
- `src/utils/constants.ts` — Event bus constants and analytics keys
- Command modules (`src/commands/*/cmds.ts`) — Emit domain-specific events via `trackEvent()` helper

### Tracked Events

| Event | Source | Properties |
|-------|--------|------------|
| `extension.activated` | ZenExtension | extensionVersion, isFirstActivation |
| `extension.first_activated` | ZenExtension | firstActivatedAt (once per install) |
| `extension.deactivated` | extension.ts | sessionDurationMs |
| `server.connected` | AnalyticsService | connectionType (local/cloud/remote/unknown) |
| `server.disconnected` | AnalyticsService | connectionType, disconnectReason (user_initiated/unexpected) |
| `server.connect_command` | server/cmds | connectionType, success |
| `server.disconnect_command` | server/cmds | success |
| `server.connection_failed` | server/cmds | connectionType, serverUrlCategory, docker, portProvided, errorKind, errorSource, messageHash |
| `error.occurred` | LSClient | operation, phase, errorKind, errorSource, messageHash |
| `stack.*` events | stack/cmds | Various (see code) |
| `pipeline.*` events | pipelines/cmds | Various (see code) |
| `component.registered` | ComponentsForm | componentType, flavor, success |
| `component.updated` | ComponentsForm | componentType, flavor, success |
| `component.deleted` | components/cmds | componentType, flavor, success, (error taxonomy on failure) |

### Common Properties (on every event)

extensionVersion, vscodeVersion, platform, timestamp, sessionId, pythonVersion*, zenmlVersion*, zenmlInstalled*

(*Available after LSP/interpreter initialization)

### Privacy-Safe Error Tracking

Error analytics use `src/utils/analytics.ts` which:
- Classifies errors into an `ErrorKind` taxonomy (never raw messages)
- Produces a `messageHash` (SHA-256 of normalized message, stripped of URLs/paths/UUIDs)
- Never emits raw URLs, file paths, error messages, or PII

When adding new error tracking, always use `sanitizeErrorForAnalytics()`.

### Adding New Analytics Events

1. Import `EventBus` and `ANALYTICS_TRACK` from constants
2. Create a `trackEvent` helper (see `server/cmds.ts` for pattern)
3. Emit with `trackEvent('domain.action', { ...properties })`
4. Never include raw URLs, paths, names, or error messages — use `categorizeServerUrl()` and `sanitizeErrorForAnalytics()` for privacy

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
