# HyperCode Phase 12 — Final Maintenance Readiness

执行时间：2026-09-16（Asia/Shanghai）

## Result

`MAINTENANCE_READY_WITH_KNOWN_DEBT`

`PROJECT CLOSED`。本报告是当前治理任务的最终闭环，不创建 Phase 13，不重新寻找 slimming candidate。

## Final Identity

- Branch：`dev`
- Final HEAD：`e7333ecac2f5f4ce33fe051cfcd0e604f598e910`
- OpenCode：`1.18.30`
- Upstream commit：`193de13a88d62a6409c6d385831180f1def527dc`
- Previous integrated slimming HEAD：`25390fa4d34da1acf315ceabcd027baf62de26bd`

## Replay Closure

1. Phase 11 所有 `KEEP_REPLAY`：已处理并按责任边界提交；没有 `stash pop`、`stash drop` 或整目录覆盖。
2. `AGENTS.md`：保留当前规则并合并中文用户体验规则，已进入 maintenance commit。
3. Session repair commit：`221f06265` (`fix(sync): restore session compatibility repair`)。
4. Test repair commit：`5668f9ab9` (`test(sync): restore post-sync regression coverage`)。
5. VS Code repair commit：`9e86051a3` (`fix(vscode): restore synchronized message types`)。
6. Maintenance rules/reports commit：`b9c297738` (`chore(maintenance): restore project rules and audit history`)。
7. Future sync workflow commit：`9314e8b07` (`chore(maintenance): add upstream sync workflow`)。
8. Doubao script commit：`e7333ecac` (`chore(script): preserve real doubao validation workflow`)；脚本 blob 与 preservation stash 一致。

## Doubao Attribution

`run-real-doubao.ts` 的 18 个 type errors 不是局部类型漂移。脚本依赖的五个模块及 Layer/FS API 来自未集成的 `chatgpt-image-runtime` 分支；该分支相对当前树涉及 97 个文件、数据库 migration、Provider、Plugin、Video workflow 和 lockfile。恢复它会突破本阶段的 dependency/Frozen guardrails，因此分类为：

`KNOWN_USER_SCRIPT_TYPE_DEBT`

没有使用 `any`、`@ts-ignore`、manifest 修改或 lockfile 修改来掩盖债务。

## Validation

| Area | Result |
|---|---|
| Core typecheck | PASS |
| TUI typecheck | PASS |
| VS Code check-types/package | PASS |
| OpenAPI/SDK targeted | `49 pass / 0 fail` |
| Session targeted | `117 pass / 15 skip / 0 fail` |
| Four replay test groups | `209 pass / 1 skip / 0 fail` |
| Sync workflow test | `1 pass / 0 fail` |
| PowerShell sync script parse | PASS |
| OpenCode typecheck | F-013 + attributed Doubao debt only |
| Broad suite | `3611 pass / 58 skip / 1 todo / 7 fail` |

Broad 的 7 个失败全部是已知签名：6 个 Windows symlink `EPERM`，1 个 CLI help snapshot spacing。相比 `3610 / 58 / 1 / 8` baseline，失败减少 1；Phase 11/12 新增可归因 regression：`0`。Session aggregate timeout 在隔离重跑中通过，不计为新失败。

## Final Fork Tax

```text
Modified upstream files: 141
Production paths:        92
Core patch paths:        48
Technical surface:       792
Modified symbols:        ≈70
```

相对 Phase 5A 固化值 `140 / 92 / 48 / 798`：

- `+1 modified upstream file`：`AGENTS.md` 规则回放；治理文件，不增加 production/core surface。
- `0 production paths`、`0 core patch paths`：Slimming surface 未回退。
- `-6 technical lines`：Session processor 删除 upstream 已移除的 dangling dual-write。

## Slimming Protection

- C-017：7 个 OpenAPI branding patches 未重新引入；Core patch paths 保持 `48`。
- C-009：没有恢复 scattered CLI branding。
- C-001：没有恢复 duplicate env alias owner。
- C-002：没有恢复 duplicate config bootstrap owner。
- Session、Provider lifecycle、Plugin architecture、TUI、VS Code runtime 仍为 Frozen surfaces。

## Integrity

- `bun.lock` unchanged，baseline blob：`d1a30094ccd5e607f14859313b2e8ee951577441`。
- `packages/opencode/package.json` unchanged，baseline blob：`3f72ba0dc1dc275d53dd63eebfa5294440297147`。
- Preservation stashes retained，未 apply/pop/drop：
  - `125c4541d6270b7e911631d3a334bc7e834ee5c1`
  - `4c3f7690e2863188f7fa3e9c729060f3fcddd336`
  - `3674c90ad0b99c877a70348af05c28ef1c9985fb`
- `sdks/vscode/.vscode-test/` 是未提交生成残留，不进入 baseline 或 commit；本环境安全策略拒绝递归删除命令。

## Future Maintenance

下一次 OpenCode release 的唯一入口：

```text
scripts/sync-opencode-upstream.ps1
reports/slimming/post-slimming-baseline.md
```

已验证 PowerShell parse、`Plan`、`Measure` 和 workflow regression test。脚本不 push、不 force push、不自动解决冲突、不修改 manifest/lockfile。

## Final Recommendation

保持 `MAINTENANCE_READY_WITH_KNOWN_DEBT`。核心 HyperCode 产品、Slimming baseline、Future Sync workflow 和 regression detection 均可维护；Doubao 脚本债务只有在未来明确恢复其完整 runtime 功能时才另行决策。当前项目治理任务正式 CLOSED。
