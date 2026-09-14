# Phase 4 Core Patch Audit

比较范围：`193de13a88d62a6409c6d385831180f1def527dc..0472ed06209bc24eb76508005b16737aa0d8638c`。这里的“Core patch”指目标中已存在、post-sync 仍被 HyperCode 修改的 `packages/core/src/**` 或 `packages/opencode/src/**` 路径；新增 HyperCode-only 文件不计入总数。

## Inventory Summary

- Total upstream files still modified: **55**（`M`/`T`，不含新增文件）。
- `packages/core/src`: 4 paths；`packages/opencode/src`: 51 paths。
- Evidence command：`git diff --name-status --diff-filter=MT 193de13a..0472ed062 -- packages/core/src packages/opencode/src`。

| Classification | Count | Interpretation |
|---|---:|---|
| `CORE_PATCH_REQUIRED` | 24 | 品牌入口、环境变量兼容、离线/配置/公开 API 等当前仍有消费者 |
| `CORE_PATCH_SIMPLIFIABLE` | 15 | 主要是重复品牌文案、错误/帮助包装或可集中资源的轻量差异 |
| `CORE_PATCH_PLUGIN_CANDIDATE` | 5 | provider/plugin/OAuth 行为可在不改变产品契约的前提下进一步隔离 |
| `CORE_PATCH_PACKAGE_CANDIDATE` | 2 | 适合独立 compatibility/package 边界，但需 API 证据 |
| `CORE_PATCH_OBSOLETE` | 0 | 未找到可在无运行时验证下安全判定 obsolete 的路径 |
| `CORE_PATCH_UNKNOWN` | 9 | 动态发现、协议兼容或缺少测试环境，暂不推断 |
| **Total** | **55** | 仅审计，不执行迁移 |

## Top 20 Highest-Cost Patches

评分维度顺序：`Fork Surface / Conflict Frequency / Core Invasiveness / Test Difficulty / Upstream Overlap`，每项 0–3，总分 0–15。行数来自 `git diff --numstat`，用于排序而非价值判断。

| Rank | Path | Diff lines | Score | Classification | Evidence / possible Phase 5 shape |
|---:|---|---:|---:|---|---|
| 1 | `packages/opencode/src/plugin/xai.ts` | 254 | 12 | `CORE_PATCH_PLUGIN_CANDIDATE` | loopback OAuth/CORS/PKCE/state 大块实现；目标同文件有 plugin API，可先保留契约再隔离实现 |
| 2 | `packages/opencode/src/config/config.ts` | 90 | 12 | `CORE_PATCH_REQUIRED` | bundled config、文件名兼容、plugin dependency policy 均有消费者；只能做最小 adapter |
| 3 | `packages/opencode/src/cli/ui.ts` | 69 | 7 | `CORE_PATCH_SIMPLIFIABLE` | 主要为 logo/wordmark 渲染；可集中到 Brand/resource，不改变 CLI 行为 |
| 4 | `packages/core/src/flag/flag.ts` | 43 | 9 | `CORE_PATCH_REQUIRED` | `HYPERCODE_*` alias 是公开兼容入口；与 runtime-flags 存在重复实现 |
| 5 | `packages/opencode/src/effect/runtime-flags.ts` | 32 | 9 | `CORE_PATCH_REQUIRED` | Effect config alias/boolean parsing 影响启动；需与 flag 单一来源对齐 |
| 6 | `packages/opencode/src/cli/cmd/pr.ts` | 13 | 6 | `CORE_PATCH_SIMPLIFIABLE` | 品牌文案与 `Brand.command` 调用；可集中资源 |
| 7 | `packages/opencode/src/session/processor.ts` | 12 | 15 | `CORE_PATCH_UNKNOWN` | V2 assistant dual-write、summary 边界和 provider diagnostics；必须保持高风险 |
| 8 | `packages/opencode/src/acp/service.ts` | 12 | 10 | `CORE_PATCH_SIMPLIFIABLE` | ACP auth/agentInfo 品牌文案；协议行为来自 upstream |
| 9 | `packages/opencode/src/server/routes/instance/httpapi/groups/global.ts` | 10 | 5 | `CORE_PATCH_SIMPLIFIABLE` | OpenAPI description 仅品牌替换，可由资源层统一 |
| 10 | `packages/opencode/src/server/routes/instance/httpapi/groups/instance.ts` | 10 | 5 | `CORE_PATCH_SIMPLIFIABLE` | 同上，未改变 endpoint schema |
| 11 | `packages/opencode/src/session/session.ts` | 9 | 15 | `CORE_PATCH_UNKNOWN` | SessionExecutionLocal/location integration；缺运行时验证，不可迁移 |
| 12 | `packages/opencode/src/cli/cmd/mcp.ts` | 9 | 8 | `CORE_PATCH_PLUGIN_CANDIDATE` | MCP 命令品牌和 OAuth 入口；可依赖 upstream MCP service 后再缩小 |
| 13 | `packages/opencode/src/cli/error.ts` | 8 | 6 | `CORE_PATCH_SIMPLIFIABLE` | 错误 banner 品牌化，行为等价 |
| 14 | `packages/opencode/src/index.ts` | 8 | 12 | `CORE_PATCH_REQUIRED` | `hypercode` scriptName、license gate、命令注册属于公开入口 |
| 15 | `packages/opencode/src/cli/cmd/github.handler.ts` | 8 | 6 | `CORE_PATCH_SIMPLIFIABLE` | 用户可见品牌和调用入口差异 |
| 16 | `packages/opencode/src/provider/provider.ts` | 7 | 13 | `CORE_PATCH_PLUGIN_CANDIDATE` | provider metadata/fallback 与 upstream registry 高度重叠 |
| 17 | `packages/opencode/src/cli/cmd/upgrade.ts` | 6 | 5 | `CORE_PATCH_SIMPLIFIABLE` | 品牌文案/命令入口，需保留发行渠道语义 |
| 18 | `packages/opencode/src/session/prompt/anthropic.txt` | 6 | 13 | `CORE_PATCH_UNKNOWN` | 模型 prompt 文本影响行为，不能按字符串差异删除 |
| 19 | `packages/opencode/src/server/routes/instance/httpapi/groups/session.ts` | 6 | 6 | `CORE_PATCH_SIMPLIFIABLE` | OpenAPI 描述品牌替换，schema 未变 |
| 20 | `packages/opencode/src/cli/cmd/uninstall.ts` | 6 | 5 | `CORE_PATCH_SIMPLIFIABLE` | 品牌文案和命令提示，可后续集中 |

其余 35 个修改路径包含 `packages/opencode/src/server/*`、`mcp/*`、`plugin/*`、`provider/error.ts`、`config/paths.ts`、`installation/*`、`temporary.ts`、`packages/core/src/config.ts`、`v1/config/server.ts` 等；按上述分类表纳入总数，未发现可直接标记 `CORE_PATCH_OBSOLETE` 的路径。

## Migration Questions

- Upstream hook：provider/plugin 已有 registry 和 plugin API，可作为 C-006/C-007 的后续隔离点。
- Config：upstream `ConfigV2Compat` 可承接 schema/lowering，但 bundled 与 `hypercode.*` 文件名仍需 adapter。
- Plugin：xAI/OAuth 和 provider-specific behavior 是最明确候选；本阶段不移动目录。
- Package：env alias 与 brand resource 可形成 compatibility package，但需先证明所有 import/dynamic reference。
- Agent/Skill：仅承载工作流，不替代 runtime core patch。
- Unknown：Session、prompt、协议路径在验证环境恢复前保持 `CORE_PATCH_UNKNOWN`。
