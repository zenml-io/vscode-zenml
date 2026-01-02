# Repository Guidelines

## Task Tracking

Use 'bd' CLI for task tracking.

## Project Structure & Module Organization
- `src/` contains the TypeScript extension code (commands, views, services, utilities).
- `bundled/tool/` contains the Python LSP server and ZenML client wrappers used by the extension.
- `src/test/ts_tests/` contains TypeScript tests (Mocha + VS Code test runner).
- `src/test/python_tests/` contains Python LSP tests (pytest) and `test_data/` fixtures.
- `resources/` holds icons and images; `dist/` and `out/` are generated build outputs.
- `scripts/` provides helper scripts like `clear_and_compile.sh`, `format.sh`, and `lint.sh`.

## Build, Test, and Development Commands
- `npm install` installs Node dependencies.
- `npm run compile` bundles the extension into `dist/` via webpack.
- `npm run watch` rebuilds on file changes for local development.
- `npm run test` runs extension tests (pretest compiles and lints first).
- `npm run lint` runs ESLint on `src/`.
- `npm run format` formats TS/JSON with Prettier.
- `nox --session setup` creates the Python tool environment for the bundled server.
- `nox --session tests` runs pytest in `src/test/python_tests/`.
- `nox --session lint` runs Python lint/format checks.
- `scripts/clear_and_compile.sh` clears caches and recompiles if the build gets stuck.

## Coding Style & Naming Conventions
- TypeScript follows ESLint rules and Prettier formatting; keep `camelCase` for functions and `PascalCase` for classes.
- Test files in `src/test/ts_tests/` should be named `*.test.ts`.
- Python style for `bundled/tool/` is enforced via the nox lint session and `scripts/lint.sh`.

## Testing Guidelines
- TypeScript tests run under the VS Code test runner (Mocha) via `npm run test`.
- Python tests use pytest; run them with `nox --session tests`.
- Add tests alongside behavior changes, and place Python fixtures under `src/test/python_tests/test_data/`.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat: add stack refresh retry`).
- Create branches from `develop` and open PRs against `zenml-io/vscode-zenml`.
- PRs should include a concise change description and testing notes; link related issues when available.

## Configuration Notes
- Extension settings live in VS Code settings (`zenml.serverUrl`, `zenml.accessToken`, `zenml-python.*`).
- Avoid committing secrets or environment-specific configuration.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
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
