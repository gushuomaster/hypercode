# Phase 4.6 Sync Repairs

本报告只记录高置信、最小范围的同步残留修复；不包含依赖升级、lockfile/manifest 修改或 Phase 5 slimming。

| Repair ID | Failure ID | Root cause / why sync-introduced | Files changed | Before → After | Validation | Risk | Commit candidate |
|---|---|---|---|---|---|---|---|
| R-001 | F-007 | Layer API 已迁移到 LayerNode，但测试仍引用旧 `infra`、`testFlock`、`defaultLayer` | `packages/opencode/test/config/config.test.ts` | undefined/旧 layer → `LayerNode.compile(...)` 与 `EffectFlock.node` | config test 118 pass / 0 fail | Low | `test(opencode): migrate config test layers` |
| R-002 | F-010 | Plugin loader 仅部分完成 LayerNode 迁移，单个 block 保留旧 `Plugin.layer`/`EventV2Bridge.defaultLayer` | `packages/opencode/test/plugin/loader-shared.test.ts` | 旧 layer wiring → `LayerNode.compile(Plugin.node, [...])` | 29 pass / 0 fail | Low | `test(opencode): finish plugin loader layer migration` |
| R-003 | F-011 | `seen` 重命名为 `createRequests` 后过滤表达式未同步 | `packages/opencode/test/share/share-next.test.ts` | `seen.filter` → `createRequests.filter` / `filteredRequests` | 7 pass / 0 fail | Low | `test(opencode): fix share request assertion variable` |
| R-004 | F-012 | Compaction LayerNode 环境遗漏 `SessionStatus.node` | `packages/opencode/test/session/compaction.test.ts` | 缺 service → 注入 `SessionStatus.node` | 55 pass / 1 skip / 0 fail | Low | `test(opencode): provide session status in compaction` |
| R-005 | F-008 | xAI OAuth 使用点保留而 helper/import/constants 被冲突解析删除 | `packages/opencode/src/plugin/xai.ts` | undefined OAuth helpers → 恢复 PKCE、loopback server、HTML escape、token exchange | xAI test 24 pass / 0 fail；typecheck 相关错误消失 | Medium | `fix(opencode): restore xai oauth helpers` |
| R-006 | F-009/F-015 | upstream 已停止 legacy V2 emission，但 merge 仍保留 `step-start` stale call | `packages/opencode/src/session/processor.ts` | `session.next.step.started` emitted → 删除残留调用 | processor-effect 17 pass / 0 fail | Medium；session 仍 high-risk | `fix(opencode): remove stale session v2 step event` |

## Scope Confirmation

- 未修改 `bun.lock`、任何 package manifest 或依赖版本。
- 未改变产品业务语义；R-005 恢复 pre-sync 已存在且仍被调用的 OAuth 能力，R-006 对齐 upstream 的 legacy event removal。
- 以上改动尚未提交，待用户确认后再决定是否拆分提交。
