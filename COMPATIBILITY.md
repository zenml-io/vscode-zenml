# ZenML VS Code Extension Compatibility

This document tracks compatibility expectations between ZenML versions and the
ZenML VS Code extension. It is intentionally lightweight; add detail as we
validate more combinations.

## Minimum Supported ZenML Version

- Extension 0.0.11 expects ZenML 0.63.0 or newer.
- This minimum is enforced at runtime by the extension and the LSP server.

## Compatibility Matrix (Draft)

| Extension version | Minimum ZenML | Notes |
| --- | --- | --- |
| 0.0.11 | 0.63.0 | Matches README requirements and runtime checks |

## Updating This File

When changing the minimum or adding a new mapping:

1. Update README requirements.
2. Update `MIN_ZENML_VERSION` in `bundled/tool/constants.py`.
3. Update `MIN_ZENML_VERSION` in `src/utils/constants.ts`.
4. Add a row in the matrix above.
