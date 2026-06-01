# HyperCode Rebrand Report

## Goal

Rebrand the user-visible OpenCode surface to HyperCode while preserving upstream sync ability and compatibility-sensitive internals.

## Completed In This Pass

- Established a clean git baseline and completed a repository-wide branding audit.
- Added `docs/hypercode-rebrand-audit.md`.
- Rebranded selected user-visible English surfaces to `HyperCode`:
  - root `README.md`
  - CLI help/error presentation
  - VS Code extension display metadata
  - English app and desktop UI copy
- Added a primary `hypercode` CLI bin while retaining `opencode`.
- Added compatibility support for:
  - `HYPERCODE_*` environment variables with `OPENCODE_*` fallback
  - `hypercode.json` / `hypercode.jsonc`
  - `.hypercode/` alongside `.opencode/`
- Added automation scripts:
  - `scripts/rebrand-opencode-to-hypercode.mjs`
  - `scripts/sync-opencode-upstream.ps1`

## Remaining OpenCode References And Why They Remain

- `@opencode-ai/*` package names and import paths:
  - preserved for build compatibility and upstream sync safety
- `packages/opencode` directory and internal `@opencode/...` service identifiers:
  - preserved to avoid invasive refactors
- license, attribution, and upstream GitHub URLs:
  - preserved intentionally
- localized non-English UI strings:
  - not yet fully rebranded in this pass
- existing `.opencode` and `OPENCODE_*` usage:
  - retained as compatibility fallback

## CLI Status

- `hypercode` bin: added
- `opencode` bin: preserved
- CLI help display: switched to `hypercode`

## Config Status

- New supported names:
  - `HYPERCODE_*`
  - `hypercode.json`
  - `hypercode.jsonc`
  - `.hypercode/`
- Old fallback names kept:
  - `OPENCODE_*`
  - `opencode.json`
  - `opencode.jsonc`
  - `.opencode/`

## Scripts

- Rebrand check:
  - `node scripts/rebrand-opencode-to-hypercode.mjs --dry-run`
- Rebrand write:
  - `node scripts/rebrand-opencode-to-hypercode.mjs --write`
- Upstream sync dry-run:
  - `powershell -File scripts/sync-opencode-upstream.ps1`
- Upstream sync write:
  - `powershell -File scripts/sync-opencode-upstream.ps1 -Write`

## Risks And Follow-Up

- Build/test verification is currently blocked by environment setup:
  - `bun install` failed during `electron` postinstall with `ECONNRESET`
  - `packages/opencode` validation therefore still lacks a successful `bun typecheck` and CLI runtime check
- Snapshot and localization coverage still need a wider pass.
- Cache/data/state directory migration is not yet moved to a new HyperCode root with fallback.
- Install/update URLs and package names still point to OpenCode infrastructure and should only change once HyperCode distribution endpoints exist.
