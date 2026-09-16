# Phase 5A Validation Baseline

## Baseline identity

- Worktree：`D:\project\hypercode\.worktrees\opencode-1.18.30-sync`
- Post-sync commit：`0472ed06209bc24eb76508005b16737aa0d8638c`
- Pure upstream reference：`193de13a88d62a6409c6d385831180f1def527dc`
- Pre-sync HyperCode reference：`b965c81d32ceddd6f05e982ad99abc4e0dff93bb`
- Bun：`1.3.14`
- `bun.lock`：unchanged；manifests unchanged

## Typecheck baseline

| Surface | Command | Baseline |
|---|---|---|
| VS Code | `sdks/vscode bun run check-types` | PASS |
| Core | `packages/core bun typecheck` | PASS |
| TUI | `packages/tui bun typecheck` | PASS |
| OpenCode | `packages/opencode bun typecheck` | F-013 only |

F-013 signature：`NpmTest.noop` 的 `which` 返回 `Effect<Option<never>>`，而 `Npm.Service.which` 要求 `Effect<string | undefined>`。该代码在 pre-sync 已存在，分类为 `TRUSTED_BASELINE_RED`，不属于 Phase 3 sync 或 Phase 4.8 regression。

## Broad test baseline

| Surface | Result | Known failures |
|---|---|---|
| Core | `1089 pass / 7 skip / 4 fail` | Core-F01–F04 |
| TUI | `195 pass / 1 skip / 3 fail` | F-005/F-006（3 个断言） |
| OpenCode | `3607 pass / 58 skip / 1 todo / 7 fail` | OpenCode-F01/F02 |

### Known failure signatures

| ID | Signature | Classification |
|---|---|---|
| Core-F01 | `Npm.add` fixture timeout | `KNOWN_BASELINE_RED` / Windows fixture timing |
| Core-F02 | Git Bash env 未被 shell preferred 读取 | `KNOWN_BASELINE_RED` / Windows environment assumption |
| Core-F03 | legacy `config.json` fixture 仍发现 document | `KNOWN_BASELINE_RED` / historical fixture baseline |
| Core-F04 | Windows `echo` combined output 带引号 | `KNOWN_BASELINE_RED` / platform process-output assumption |
| F-005 | `~/project` 与 `~\\project` separator 差异 | `KNOWN_BASELINE_RED` / Windows path assumption |
| F-006 | 断言期待 `opencode -s`，实际为 `hypercode -s` | `KNOWN_BASELINE_RED` / HyperCode branding baseline |
| OpenCode-F01 | filesystem/glob/snapshot symlink 创建返回 `EPERM`（6 项） | `KNOWN_BASELINE_RED` / Windows symlink privilege |
| OpenCode-F02 | CLI help snapshot 空格对齐差异 | `KNOWN_BASELINE_RED` / expected snapshot baseline |

## Regression rule

- Known failure remains identical：`BASELINE`。
- New failure ID/signature：`REGRESSION`。
- Known failure count or signature changes：`INVESTIGATE`。
- 任一新增失败都不得通过更新 snapshot 或放宽断言隐藏。

该 baseline 适用于 Phase 5A 白名单；A/B worktree 仍因 Windows Bun hardlink blocker 为 `ENVIRONMENT_BLOCKED`，不伪造其对照结果。
