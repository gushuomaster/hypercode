# Phase 4 Summary

## Result

`PASS_WITH_WARNINGS`

Post-sync baseline 已建立，Feature Parity、Core Patch、重复实现、dead code 和 dependency 审计均完成；验证环境因 Bun registry 解析阻塞，未满足进入 Phase 5 前的可靠运行时验证条件。

## Required Answers

1. **HyperCode-only 文件**：292 个 added paths（以 `git diff --name-status --no-renames 193de13a..0472ed062` 统计；包含报告、文档、VS Code 资源和 HyperCode-only implementation）。
2. **修改的 OpenCode 1.18.30 原生文件**：141 个 `M`，另有 5 个 type-changed；无 deleted upstream path。
3. **最大 Fork Surface**：`sdks/vscode`，236 paths；主要集中于 `src/panel/webview/app`（63）和 `src/panel/provider`（21）。
4. **VS Code 是否仍最大**：是；其独立产品面而非简单复制是主要原因，但 runtime adapter 仍有 partial overlap。
5. **Core Patch 数量**：55 个目标既有 `packages/core/src`/`packages/opencode/src` 修改路径。
6. **完整 upstream 替代**：0；没有 feature 满足严格等价条件。
7. **部分替代**：3 个主要 feature：VS Code runtime adapter、bundled config、provider/model compatibility；session 另列 high-risk keep。
8. **必须保留**：品牌与兼容入口、增强 VS Code、TUI 中文化、offline delivery、repo agents/skills/commands、session execution 高风险路径。
9. **Plugin 候选**：xAI OAuth、provider-specific compatibility、MCP auth/命令边界（仅候选，不迁移）。
10. **独立 Package 候选**：env alias/brand compatibility resource、VS Code protocol adapter（需 API 证据）。
11. **可能过时 compatibility layer**：`hypercode.*` filename compatibility、重复 env alias；均为 `LEGACY_REMOVAL_CANDIDATE`/`SIMPLIFY` 候选，不删除。
12. **High-confidence dead code**：0；动态 discovery、scripts、public exports 和 delivery refs 尚未具备完整证据链。
13. **Duplicate implementation**：2 个已确认语义重复候选（env alias parsing、brand/resource hardcodes）；未执行合并。
14. **可能无用 dependency**：0 个 `HIGH_CONFIDENCE_UNUSED_DEP`；安装和完整 consumer scan 被环境阻塞。
15. **最高 Maintenance Cost**：session runtime（15/15）、provider/model（13/15）、VS Code runtime（12/15）、config bootstrap（12/15）、xAI OAuth（12/15）。
16. **Phase 5 前 10 候选**：C-001、C-002、C-006、C-007、C-010、C-011、C-012、C-016、C-003、C-009；优先级详见 `16-post-sync-slimming-candidates.md`。
17. **可靠测试环境**：否，`VALIDATION_ENV_BLOCKED`。
18. **是否具备进入 Phase 5**：具备制定候选顺序的审计条件；不具备立即执行 P0/删除或高风险迁移的验证条件。

## Surface Metrics

使用 `--no-renames` 口径：总差异 438 paths（292 added、141 modified、5 type-changed、0 deleted）。目录/模块聚集：`sdks/vscode` 236、`packages/opencode` 92、`packages/tui` 29、`docs` 28、`packages/app` 20、`packages/core` 5。

Phase 1 的 149 modified-upstream / 282 added 与本阶段 141 / 292 不可直接比较优劣，因为基线分别是旧 merge base 和 post-sync upstream parent；本阶段仅说明同步后的剩余维护面。

## Disposition and Cost

- Feature disposition：`KEEP_CUSTOM` 7、`PARTIAL_UPSTREAM_REPLACEMENT` 3、`SIMPLIFY_CUSTOM` 2、`NEEDS_REVIEW` 2、`HIGH_RISK_KEEP` 1；其余严格替代/迁移分类为 0。
- Core patch classification：`REQUIRED` 24、`SIMPLIFIABLE` 15、`PLUGIN_CANDIDATE` 5、`PACKAGE_CANDIDATE` 2、`OBSOLETE` 0、`UNKNOWN` 9。
- `P0` candidates：0；主要候选均为 P1/P2/DEFER，必须先恢复验证环境。

## Phase 5 Gate

Phase 5 最合理的第一步是恢复可复现 Bun 安装环境，然后仅针对 P1 候选执行 test-first、逐项小范围迁移。Phase 4 到此停止，不自动进入 Phase 5。
