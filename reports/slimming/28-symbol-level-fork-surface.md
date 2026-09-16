# Phase 4.7 Symbol-Level Fork Surface

## Counting Method

- Git path baseline：`193de13a..0472ed062`，`292 A / 141 M / 5 T / 0 D`。
- `Modified upstream files` 包含基线中已存在且状态为 `M` 或 `T` 的路径。
- 生产源级 modified-upstream 面约 107 paths：`packages/core/src` 4、`packages/opencode/src` 51、`packages/tui/src` 22、`packages/app/src` 19、VS Code/其他元数据若干；测试、文档和资源另列。
- `Modified upstream symbols` 使用 diff hunk 的最近顶层 declaration 合并重复字符串替换，得到约 **76 个 symbol groups**；这是静态近似，不等价于完整 AST semantic diff。
- HyperCode-only production TS/TSX 中检测到约 **602 个 exported declarations**（130 个非测试生产文件）；其中 VS Code 产品层约 31,850 added LOC，占新增生产代码约 35,506 LOC 的主体。

## Surface Summary

| Metric | Approximate result | Interpretation |
|---|---:|---|
| Modified upstream files | 146 (`141 M + 5 T`) | 文件级维护面 |
| Modified upstream production paths | ≈107 | 去除 reports/docs/test 后的技术面近似 |
| Modified upstream symbol groups | ≈76 | hunk→declaration 静态归并 |
| HyperCode-only exported declarations | ≈602 | 含 UI/product layer，不作为删除计数 |
| HyperCode custom LOC in modified core/opencode source | ≈1,067 changed lines | 55 Core patch paths，包含 session/config/provider/plugin/CLI |
| Thin patch files | 45 core/opencode source files at ≤12 changed lines | 主要是 branding/API descriptions/compat wrappers |
| HyperCode-only production LOC | ≈35,506 added lines | VS Code ≈31,850；TUI ≈695；其余 runtime/scripts |

## Classification of Core Patches

| Static class | Count | Typical evidence |
|---|---:|---|
| `CORE_SEMANTIC_PATCH` | 4 | Session processor/session listing、config lifecycle、provider display semantics |
| `CORE_EXTENSION_PATCH` | 6 | xAI OAuth、provider-specific loaders、MCP/IDE integration |
| `CORE_DEFAULT_PATCH` | 8 | retry copy、prompt defaults、mDNS/default labels |
| `CORE_REGISTRATION_PATCH` | 5 | CLI command registration、provider/plugin registration、offline entry points |
| `CORE_TYPE_PATCH` | 2 | public schema/metadata shape adjustments |
| `CORE_COMPAT_PATCH` | 21 | env aliases、config filenames、Brand/CLI/API compatibility |
| `CORE_UNKNOWN` | 9 | protocol/session/prompt paths requiring runtime evidence |
| **Total** | **55** | 与 `18-core-patch-audit.md` path inventory 对齐 |

## Top 20 Modified Upstream Symbols / Symbol Groups

| Rank | Path | Symbol group | Approx. changed LOC | Static class | Disposition |
|---:|---|---|---:|---|---|
| 1 | `packages/opencode/src/plugin/xai.ts` | `XaiAuthPlugin`, `buildAuthorizeUrl`, `waitForOAuthCallback`, `exchangeCodeForTokens` | 254 | `CORE_EXTENSION_PATCH` | `EXTRACT_CANDIDATE`, runtime required |
| 2 | `packages/opencode/src/config/config.ts` | `globalConfigCandidates`, `globalConfigFile`, `Config.layer` | 90 | `CORE_COMPAT_PATCH` | partial upstream, guardrails |
| 3 | `packages/opencode/src/cli/ui.ts` | `logo`, `wordmark`, `Style` | 69 | `CORE_DEFAULT_PATCH` | thin/resource candidate |
| 4 | `packages/core/src/flag/flag.ts` | `env`, `truthy`, `enabledByExperimental`, `Flag` | 43 | `CORE_COMPAT_PATCH` | duplicate implementation |
| 5 | `packages/opencode/src/effect/runtime-flags.ts` | `names`, `string`, `bool`, `Service`, `layer` | 32 | `CORE_COMPAT_PATCH` | duplicate implementation |
| 6 | `packages/opencode/src/session/session.ts` | `Session.layer`, directory normalization in list path | 9 | `CORE_SEMANTIC_PATCH` | runtime required |
| 7 | `packages/opencode/src/session/processor.ts` | `SessionProcessor.layer`, step snapshot boundaries | 12 | `CORE_SEMANTIC_PATCH` | high-risk keep |
| 8 | `packages/opencode/src/cli/cmd/pr.ts` | `PrCommand` | 13 | `CORE_REGISTRATION_PATCH` | Brand/resource candidate |
| 9 | `packages/opencode/src/acp/service.ts` | `make`, `fromUnknownError` | 12 | `CORE_DEFAULT_PATCH` | resource candidate |
| 10 | `packages/opencode/src/provider/provider.ts` | `custom`, `fromModelsDevProvider` | 7 | `CORE_EXTENSION_PATCH` | provider overlap |
| 11 | `packages/opencode/src/cli/cmd/mcp.ts` | `McpListCommand`, `McpAddCommand`, `McpDebugCommand` | 9 | `CORE_REGISTRATION_PATCH` | Brand/resource candidate |
| 12 | `packages/core/src/config.ts` | `Config names` array | 2 | `CORE_COMPAT_PATCH` | config filename compatibility |
| 13 | `packages/opencode/src/server/mdns.ts` | `publish` | 6 | `CORE_DEFAULT_PATCH` | Brand/resource candidate |
| 14 | `packages/opencode/src/session/retry.ts` | `retryable` message payload | 2 | `CORE_DEFAULT_PATCH` | copy/resource candidate |
| 15 | `packages/opencode/src/temporary.ts` | CLI `scriptName` setup | 2 | `CORE_COMPAT_PATCH` | keep public command |
| 16 | `packages/opencode/src/installation/index.ts` | `userAgent` | 3 | `CORE_COMPAT_PATCH` | preserve compatibility |
| 17 | `packages/opencode/src/ide/index.ts` | `install` extension ID | 3 | `CORE_REGISTRATION_PATCH` | VS Code runtime blocked |
| 18 | `packages/opencode/src/mcp/index.ts` | client naming and command identity | 5 | `CORE_EXTENSION_PATCH` | protocol/runtime blocked |
| 19 | `packages/opencode/src/server/routes/.../global.ts` | `GlobalApi` descriptions | 10 | `CORE_DEFAULT_PATCH` | thin patch |
| 20 | `packages/opencode/src/server/routes/.../instance.ts` | `InstanceApi` descriptions | 10 | `CORE_DEFAULT_PATCH` | thin patch |

## Product vs Technical Surface

- **Product-only surface**：VS Code panel/sidebar/webview、TUI locale resources、HyperCode commands/branding、license/offline delivery、repo workflows；主要由 HyperCode-only paths 构成，不能和 upstream 技术 patch 等价。
- **Technical surface**：env/config compatibility、provider/plugin registration、session directory/processor、MCP/IDE adapters、API metadata wrappers；约 55 个 Core patch paths 是主要长期 merge surface。
- **Branding/localization** 单独统计：它们提高产品差异，但不自动构成架构冗余。
- **Offline capability** 单独统计：Linux/Windows packaging scripts 有 active package/CI references，不因 upstream 没有等价脚本而判为坏 fork。
