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
- `./scripts/lint.sh` runs full lint suite (ruff, mypy, eslint, yamlfix) - **run before commits**
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
