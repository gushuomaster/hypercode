# Phase 4.6 Validation Attribution Matrix

## A/B Runtime Status

| Baseline | Install / runtime status | Reason |
|---|---|---|
| Pure upstream `193de13a88d62a6409c6d385831180f1def527dc` | `NOT_TESTED` | `UPSTREAM_VALIDATION_ENV_INCOMPLETE`：Bun frozen offline install 遇 Windows hardlink target path missing |
| Pre-sync HyperCode `b965c81d32ceddd6f05e982ad99abc4e0dff93bb` | `NOT_TESTED` | `UPSTREAM_VALIDATION_ENV_INCOMPLETE`：同一 A/B hardlink blocker |
| Post-sync HyperCode `0472ed06209bc24eb76508005b16737aa0d8638c` | Partial runtime | 主 worktree 可离线安装，但 Drizzle variant、VS Code 类型和历史断言仍有红灯 |

## Attribution

| Area / command | Post-sync | Pure upstream | Pre-sync | Attribution | Confidence | Phase 5 disposition |
|---|---|---|---|---|---|---|
| Root online frozen install | ENVIRONMENT_RED | NOT_TESTED | NOT_TESTED | `ENVIRONMENT_NETWORK_FAILURE` | High | no dependency workaround |
| A/B offline frozen install | — | ENVIRONMENT_BLOCKED | ENVIRONMENT_BLOCKED | `ENVIRONMENT_FAILURE` | High | block runtime comparison |
| Core typecheck/tests | typecheck PASS; broad `1089/7/4` | NOT_TESTED | NOT_TESTED | Drizzle cascade closed; remaining failures are Windows/fixture baseline | High for typecheck; Medium for A/B | no slimming |
| OpenCode typecheck | RED (historical Npm typing only after repairs) | NOT_TESTED | NOT_TESTED | targeted sync repairs green; remaining historical red | High | guardrails |
| OpenCode config test | PASS (118/118) | NOT_TESTED | NOT_TESTED | F-007 repaired sync regression | High | candidate C-002 only with fresh-home checks |
| OpenCode plugin loader | PASS (29/29) | NOT_TESTED | NOT_TESTED | F-010 repaired sync regression | High | targeted only |
| OpenCode xAI plugin | PASS (24/24) | NOT_TESTED | NOT_TESTED | F-008 repaired sync regression | High | C-007 may be analyzed, no extraction yet |
| OpenCode share-next | PASS (7/7) | NOT_TESTED | NOT_TESTED | F-011 repaired sync regression | High | no direct slimming impact |
| OpenCode compaction | PASS (55/55, 1 skip) | NOT_TESTED | NOT_TESTED | F-012 repaired sync regression | High | session guardrails |
| OpenCode processor effect | PASS (17/17) | NOT_TESTED | NOT_TESTED | F-009/F-015 repaired sync regression | High | keep session high risk |
| TUI broad tests | RED (3 fail) | NOT_TESTED | NOT_TESTED | F-005/F-006：Windows separator 与 HyperCode branding baseline | High | C-011 guardrails |
| TUI typecheck | PASS | NOT_TESTED | NOT_TESTED | Drizzle cascade closed after relink | High post-sync; A/B blocked | no slimming |
| VS Code check-types | PASS after R-001 | NOT_TESTED | NOT_TESTED | `SYNC_INTRODUCED_REGRESSION`：upstream `ContentFilterError` 漏入 HyperCode adapter union，已最小修复 | High | runtime matrix still required; no slimming |
| App typecheck/build | PASS / PASS_WITH_WARNINGS | NOT_TESTED | NOT_TESTED | trusted post-sync green | High | no blocker from app |
| OpenCode broad tests | RED (`3607/58/1/7`) | NOT_TESTED | NOT_TESTED | 6 Windows symlink `EPERM` + 1 CLI help snapshot baseline | High for primary cluster | no slimming |
| OpenCode build | RED | NOT_TESTED | NOT_TESTED | Drizzle module resolution plus build-script side effects | High | no build-based deletion |

`NOT_TESTED` 表示没有可用 A/B runtime baseline，不表示通过或失败。
