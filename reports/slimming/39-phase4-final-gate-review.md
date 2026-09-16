# Phase 4 Final Gate Review

## Final decision

```text
Phase 4: PASS_WITH_WARNINGS (CLOSED)
Phase 5A Gate: READY_FOR_PHASE_5A
```

Phase 4 不再扩展为 4.9/4.10 等阶段。下一步只能按 [38-phase5a-allowlist.md](38-phase5a-allowlist.md) 进行受 Guardrail 限制的低风险工作。

## Required answers

1. **当前是否还有 critical `UNATTRIBUTED_RED`？** 没有。F-001/F-002/F-003/F-004、F-013、Core/TUI/OpenCode broad failures 均已有 signature、classification 和 evidence；A/B hardlink 是已归因的环境阻塞，不是未归因代码红灯。
2. **当前是否还有 unresolved sync regression？** 没有。F-007–F-012 已修复；F-014 `ContentFilterError` union 已完成 R-001 修复并通过 VS Code check-types。
3. **F-013 是否仅属于 baseline debt？** 是。`NpmTest.noop` 类型在 pre-sync 已存在，当前 OpenCode typecheck 仅此一项。
4. **Core 4 fail 是否均已归因？** 是：npm fixture timeout、Windows shell env、legacy config fixture、Windows `echo` 输出。
5. **TUI 3 fail 是否均已归因？** 是：1 个 Windows separator 断言和 2 个 HyperCode branding 断言，均为已知 baseline。
6. **OpenCode 7 fail 是否均已归因？** 是：6 个 Windows symlink `EPERM` 和 1 个 CLI help snapshot 空格差异。
7. **当前 validation baseline 是否足以检测新增 regression？** 对 Phase 5A 白名单足够。Baseline 已冻结，规则为 known signature 保持不变；新增失败标记 regression，已知失败变形则 investigate。A/B 对照仍不用于白名单之外区域。
8. **哪些候选已经具备独立 validation？** C-009 具备最完整的 typecheck/build/help 检测；C-001、C-002、C-005、C-007/C-008、C-012 具备 targeted 或 package/script validation，但必须遵循各自 guardrail。
9. **哪些区域继续冻结？** Session、VS Code runtime/protocol、TUI architecture、Provider lifecycle、Plugin architecture、Drizzle/dependency topology、global config schema、License 和 Video workflow。
10. **当前是否可以开始 Phase 5A？** 可以，且仅允许白名单；不得把 READY_FOR_PHASE_5A 解读为允许全项目 slimming。

## Gate evidence

- Typecheck：VS Code/Core/TUI PASS；OpenCode 仅 F-013。
- Broad baseline：Core `1089/7/4`、TUI `195/1/3`、OpenCode `3607/58/1/7`，全部 known baseline red。
- Dependency state：`bun.lock` unchanged；manifests unchanged；无 unresolved merge conflict 或 dirty generated artifact。
- Sync repair：仅 R-001，见 [36-phase4.8-sync-repairs.md](36-phase4.8-sync-repairs.md)。
- Baseline signature：见 [37-phase5-validation-baseline.md](37-phase5-validation-baseline.md)。

## Final output

```text
Critical unattributed failures: 0
Unresolved sync regressions: 0
Validation baseline: ESTABLISHED
Phase 5A allowed candidates: C-009, C-001, C-002, C-007, C-008, C-012, C-005
Frozen areas: Session, VS Code, TUI architecture, Provider lifecycle, Plugin architecture, Drizzle/dependency, global schema, License, Video workflow
Phase 5A Gate: READY_FOR_PHASE_5A
```
