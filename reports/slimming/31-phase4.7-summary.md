# Phase 4.7 Summary

## Result

- Phase 4.7：`PASS_WITH_WARNINGS`
- Phase 5 Gate：`NOT_READY_FOR_PHASE_5`
- 本阶段只完成静态分析和报告；没有删除、移动、重命名、重构、格式化、依赖/manifest/lockfile 修改或生成代码更新。

## Answers

1. **Technical Fork Surface**：核心长期技术面为 55 个 `packages/core/src`/`packages/opencode/src` modified paths、约 1,067 changed LOC；扩展到 TUI/App 等 modified upstream production paths 约 107 paths，约 3k changed LOC（口径见 symbol report）。
2. **Product-only Fork Surface**：主要是 HyperCode-only VS Code/TUI/branding/license/offline/workflow；新增 production TS/TSX 约 35,506 LOC，其中 VS Code 约 31,850 LOC。不能与 technical patch 混为一个删除数字。
3. **Modified upstream symbols**：约 76 个 symbol groups，基于 155 diff hunks 的 declaration-level 静态归并。
4. **Thin patches**：45 个 Core/OpenCode source files 的 changed LOC ≤12，主要是品牌/API descriptions/compat wrappers。
5. **Core Semantic Patch**：约 4 组，集中在 session/config/provider lifecycle；全部至少 runtime-sensitive。
6. **Core Extension Patch**：约 6 组，集中在 xAI/provider/MCP/IDE integration；xAI 是最高 extraction value。
7. **Upstream overlap**：严格 `STATIC_EQUIVALENT` 为 0；`STATIC_PARTIAL_EQUIVALENT` 主要在 config、provider、VS Code runtime adapter、OAuth callback page。
8. **Semantic duplicate**：2 组：env alias parser、Brand/resource 与散落 branding hardcodes。
9. **High-confidence static dead candidate**：0。
10. **Possible obsolete compatibility**：2 组 medium/possible：未引用 Brand metadata fields、`trace-imports.ts` direct invocation；均不删除。
11. **Core patches that can statically move out**：offline packaging boundary为 `STATIC_FEASIBLE`；env/Brand、config、OAuth callback为 `STATIC_PARTIAL`；session/provider core暂不具备安全迁出证据。
12. **Plugin candidates**：xAI OAuth（partial）、provider metadata（partial）、MCP auth（not feasible without internal lifecycle）。
13. **Package candidates**：offline delivery（feasible）、env/Brand compatibility（partial）、config compatibility（partial）、OAuth callback utility（partial）。
14. **Must wait for runtime**：VS Code message union、Drizzle variant/Core broad、TUI broad、Session、provider fallback、offline artifact build、license runtime。
15. **VS Code static certainty**：已确定 `MessageError` 缺少 upstream SDK v2 的 `ContentFilterError`，producer/consumer 链路明确；Phase 4.8 已用单文件 union 修复并通过 check-types，但仍不能据此进行 slimming。
16. **TUI static certainty**：产品 localization/branding 与 upstream prompt/app/diff plumbing 可分离；Windows separator 和 branding test failure 仍是 validation baseline red。
17. **Session freeze**：processor/session/message/tool/stream/retry/snapshot/event ordering 全部继续冻结。
18. **Highest Fork Tax**：Session、config bootstrap、provider registry、xAI OAuth、VS Code runtime/protocol。
19. **Potentially safe future candidates without full runtime baseline**：只允许静态资源盘点、Brand/env consumer map、offline package boundary design、rebrand/sync audit 文档；不允许实际行为迁移。
20. **Absolutely blocked**：任何删除、session slimming、VS Code union/adapter 修改、TUI behavior 修改、Drizzle/dependency 迁就、provider registry replacement、config filename removal。

## Final Gate

Phase 4.7 只减少未来分析工作量，不能绕过 Phase 4.6 validation gate。由于 A/B runtime baseline、Drizzle attribution、VS Code union attribution、Core/TUI broad attribution 尚未闭合，Phase 5 继续保持 `NOT_READY_FOR_PHASE_5`。

## Reports

- `27-static-phase5-ranking.md`
- `28-symbol-level-fork-surface.md`
- `29-static-duplication-and-dead-code.md`
- `30-extension-extraction-feasibility.md`
- `31-phase4.7-summary.md`
