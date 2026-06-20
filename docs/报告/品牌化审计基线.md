# HyperCode Rebrand Audit

## Phase 0 Baseline

- Current branch: `dev`
- Current remotes:
  - `origin https://github.com/anomalyco/opencode.git`
- Working tree state: clean at audit start
- Safe to continue: yes

## Search Summary

Repository-wide search for `opencode`, `OpenCode`, `OPENCODE`, `open-code`, and `Open Code` found a large number of matches.

| Pattern | Matches | Unique files |
| --- | ---: | ---: |
| `opencode` | 21030 | 1981 |
| `OpenCode` | 8071 | 737 |
| `OPENCODE` | 2329 | 434 |
| `open-code` | 0 | 0 |
| `Open Code` | 0 | 0 |

Notes:

- Counts exclude `.git`, `node_modules`, common build outputs, and several binary/lockfile formats for a more actionable audit.
- Most remaining hits are internal package names, config paths, environment variables, test fixtures, snapshots, URLs, and brand asset filenames.

## Classification

### A. User-visible content that can be rebranded with relatively low risk

- Root documentation:
  - `README.md`
  - localized `README.*.md` files
  - `CONTRIBUTING.md`
  - `SECURITY.md`
- User-facing package metadata:
  - `package.json` description
  - `sdks/vscode/package.json` display metadata
- CLI surface text:
  - `packages/opencode/src/index.ts`
  - `packages/opencode/src/temporary.ts`
  - help text, version banner framing, and error guidance
- App and desktop UI copy:
  - `packages/app/src/i18n/*.ts`
  - `packages/desktop/src/renderer/i18n/*.ts`
  - selected TUI component text in `packages/opencode/src/cli/**`
- Release and download copy:
  - README install/download sections
  - VS Code extension titles and labels

### B. Technical entry points that can be changed, but only with compatibility work

- CLI command names and package bins:
  - `packages/opencode/package.json`
  - `packages/opencode/bin/opencode`
  - hard-coded `opencode` help/examples across CLI files and tests
- Config file names and directories:
  - `opencode.json`, `opencode.jsonc`
  - `.opencode/`
  - global config under XDG config directories
- Environment variables:
  - `OPENCODE_*` across `packages/core/src/flag/flag.ts`
  - `packages/opencode/src/effect/runtime-flags.ts`
- Cache/data/state paths and install paths:
  - `packages/core/src/global.ts`
  - installation/uninstall logic
- VS Code command IDs:
  - `opencode.openTerminal`
  - `opencode.openNewTerminal`
  - `opencode.addFilepathToTerminal`
- Tests and snapshots:
  - `packages/opencode/test/**`
  - `packages/app/**.test.ts*`
  - snapshot outputs that pin CLI names or user-facing strings

### C. Items to keep unchanged or handle very carefully in early phases

- License, copyright, and attribution:
  - `LICENSE`
  - embedded third-party notices
- Upstream identity and sync markers:
  - git remote names
  - upstream repo URLs used for syncing/release automation
- Import paths and package namespaces:
  - `@opencode-ai/*`
  - workspace package names
  - `packages/opencode` directory name
- Internal protocol/service identifiers:
  - `@opencode/...` service names
  - telemetry/log attribute keys such as `opencode.*`
- Compatibility-sensitive config/auth/cache paths:
  - existing `.opencode` discovery
  - existing `OPENCODE_*` envs
  - stored tokens and auth content
- Brand asset filenames and generated artifacts:
  - `opencode*.svg/png/zip`
  - lockfiles and generated bundles

## Recommended Replacement List

Recommended for the next implementation stages:

1. Update root README branding and the primary English documentation surface first.
2. Change CLI help/version presentation from `opencode`/`OpenCode` to `hypercode`/`HyperCode`.
3. Add a `hypercode` bin while keeping `opencode` as a compatibility alias.
4. Update VS Code `displayName`, description, and visible command titles, but keep command IDs stable for compatibility.
5. Update English app/desktop strings that explicitly mention OpenCode in visible UI.
6. Add compatibility reads for `HYPERCODE_*` and new config names before changing any default config guidance.

## Do Not Replace Yet

- `@opencode-ai/*` package names
- `packages/opencode/**` source paths
- `LICENSE` and attribution text
- upstream GitHub URLs used for release/sync flows
- telemetry keys like `opencode.agent.name`
- persisted auth/token/cache storage without a fallback strategy
- lockfiles, generated assets, snapshots, and binary files unless intentionally regenerated

## Risks

- Naive replacement would break imports, package resolution, tests, plugin compatibility, and upstream sync workflows.
- Changing cache/config/data roots without fallback could make existing users lose tokens, local config, plugins, or session history.
- Renaming VS Code command IDs or package names can break existing shortcuts and extension integrations.
- Replacing URLs or package identifiers too early could break install and update flows before HyperCode infrastructure exists.
- Help text changes ripple into CLI snapshot tests and must be regenerated deliberately.

## Next Stage Recommendation

Proceed in this order:

1. Low-risk user-visible text updates.
2. Dual CLI entrypoint support (`hypercode` primary, `opencode` compatible).
3. Config/env compatibility reads for new `hypercode` naming with old `opencode` fallback.
4. Add rebrand and upstream-sync scripts so future upstream merges can reapply branding safely.
