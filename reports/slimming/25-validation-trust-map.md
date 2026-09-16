# Phase 4.6 Validation Trust Map

## Trust Levels

- `TRUSTED_GREEN`：目标验证在当前环境重复通过，且失败归因已闭合。
- `TRUSTED_BASELINE_RED`：失败稳定存在，但属于已知基线/产品假设，不应误报为 sync regression。
- `ENVIRONMENT_BLOCKED`：缺少可运行环境或 A/B 对照。
- `ATTRIBUTED_RED`：已确认同步引入，通常已修复或有明确最小修复。
- `UNATTRIBUTED_RED`：有稳定失败，但证据不足以决定责任归属。

## Map

| Surface | Trust | Evidence / guardrail |
|---|---|---|
| App typecheck/build | `TRUSTED_GREEN` | typecheck PASS；build PASS_WITH_WARNINGS |
| Config targeted suite | `TRUSTED_GREEN` | 118 pass；整体 typecheck 仍有 F-013 historical red |
| Plugin loader / xAI | `TRUSTED_GREEN` | 分别 29/29、24/24；repair 前为 F-010/F-008 `ATTRIBUTED_RED` |
| Share-next | `TRUSTED_GREEN` | 7/7；变量残留已闭合 |
| Session compaction | `TRUSTED_GREEN` | 55 pass、1 skip；补齐 SessionStatus node |
| Session processor effect | `TRUSTED_GREEN` | 17/17；F-009/F-015 stale emission 已删除 |
| TUI | `TRUSTED_BASELINE_RED` | Windows separator 与 HyperCode branding 断言可归因历史；typecheck 另受 Drizzle cascade |
| VS Code | `TRUSTED_GREEN`（typecheck） | R-001 补齐 `ContentFilterError` 后 check-types 通过；缺 A/B runtime baseline，仍禁止 slimming |
| Core | `TRUSTED_GREEN`（typecheck）/ `TRUSTED_BASELINE_RED`（broad） | Drizzle cascade 已闭合；4 个 broad failures 均为 Windows/fixture 环境基线 |
| OpenCode broad suite/build | `TRUSTED_BASELINE_RED` | broad 为 6 个 Windows symlink `EPERM` 与 1 个 CLI help snapshot；build 仍受 install side effects guardrail 约束 |
| Pure upstream / pre-sync runtime | `ENVIRONMENT_BLOCKED` | A/B frozen offline install 均遇 Windows Bun hardlink target 缺失 |

## Gate Implication

局部 targeted green 不足以覆盖 Core、VS Code、A/B 和 broad build 缺口；因此不允许把 Phase 4.6 提升为全绿 PASS。
