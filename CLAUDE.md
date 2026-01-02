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
- `zenml-python.interpreter` - Python interpreter path


## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Run `./scripts/lint.sh` before committing
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
./scripts/lint.sh       # Run linters before committing
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
