# Phase 4 Post-Sync Slimming Candidates

基线：OpenCode `193de13a88d62a6409c6d385831180f1def527dc` → HyperCode post-sync `0472ed06209bc24eb76508005b16737aa0d8638c`。

本台账只提出候选，不执行删除、迁移、重构或依赖移除。

| ID | Feature / Module | Path | Current behavior | Upstream equivalent / evidence | Fork surface | Cost | Risk | Recommended disposition | Benefit | Priority | Validation required |
|---|---|---|---|---|---:|---:|---|---|---|---|---|
| C-001 | Env flag aliases | `packages/core/src/flag/flag.ts`, `packages/opencode/src/effect/runtime-flags.ts` | 同时读取 `HYPERCODE_*` 与 `OPENCODE_*` 环境变量 | Upstream flags 读取 `OPENCODE_*`；两处 HyperCode alias 实现可见 | 2 core files | 8 | medium | `MERGE_DUPLICATES` | 统一 alias 逻辑，减少漂移 | P1 | alias precedence tests、full typecheck |
| C-002 | Bundled config bootstrap | `packages/opencode/src/config/config.ts`, `src/config/hypercode-bundled.ts` | 创建/加载 HyperCode 与 OpenCode global/project config | Upstream `ConfigV2Compat`/config loader 已提供部分等价能力；本地保护条件仍不同 | 2+ files | 10 | high | `PARTIAL_UPSTREAM_REPLACEMENT` | 缩小 config patch | P1 | config suite、fresh-home smoke |
| C-003 | Config filename compatibility | `packages/core/src/config.ts`, `packages/opencode/src/config/paths.ts` | 支持 `config.json`、`opencode.*`、`hypercode.*` | Upstream只保证 `opencode.*`；消费者和迁移路径仍需确认 | 2 core files | 9 | high | `LEGACY_REMOVAL_CANDIDATE`（候选） | 未来移除无消费者旧名 | P2 | grep/dynamic discovery audit |
| C-004 | Session processor dual-write | `packages/opencode/src/session/processor.ts` | summary 边界下写入 V2 assistant message | Upstream 已有 V2 projector/runner，但未证明与本地镜像完全等价 | 1 core file | 13 | very high | `HIGH_RISK_KEEP` | 避免数据丢失 | DEFER | session integration tests |
| C-005 | Session retry messaging | `packages/opencode/src/session/retry.ts` | HyperCode Go 品牌和价格提示 | Upstream retry policy 等价，文案为产品差异 | 1 file | 4 | low | `SIMPLIFY_CUSTOM` | 集中文案资源 | P2 | locale/snapshot tests |
| C-006 | Provider registry extensions | `packages/opencode/src/provider/provider.ts` | HyperCode provider metadata、fallback 文案 | Upstream provider registry 已覆盖大部分模型路由 | 1 file | 11 | high | `PARTIAL_UPSTREAM_REPLACEMENT` | 减少重复 provider metadata | P1 | provider matrix tests |
| C-007 | xAI OAuth flow | `packages/opencode/src/plugin/xai.ts` | loopback OAuth、CORS、PKCE/state、HTML callback | Upstream plugin API 相同文件已有基础，但本地流程扩展较大 | 1 file / 254 lines | 12 | high | `EXTRACT_TO_PLUGIN`（形态候选） | 降低 core/plugin sync 冲突 | P1 | OAuth mock + security review |
| C-008 | Codex/DigitalOcean OAuth pages | `packages/opencode/src/plugin/openai/codex.ts`, `digitalocean.ts` | 使用共享 callback page 与品牌文案 | Upstream `OauthCallbackPage` 已提供页面能力 | 2 files | 6 | medium | `UPSTREAM_REPLACEMENT`（页面层） | 删除重复 HTML | P2 | plugin auth tests |
| C-009 | CLI branding strings | `packages/opencode/src/cli/*`, `src/cli/ui.ts` | 命令名、帮助、logo、错误提示品牌化 | Upstream CLI 行为等价，只有产品名称不同 | 20 CLI paths | 6 | low | `SIMPLIFY_CUSTOM` | 集中 Brand/resource，减少 hardcode | P2 | help snapshots、CLI smoke |
| C-010 | VS Code enhanced product | `sdks/vscode/src/**` | panel/sidebar/session/todo/diff/subagent/workspace runtime | Upstream VS Code 扩展较轻，未提供同等产品面；`package.json` 仅 metadata 有重叠 | 236 paths | 13 | high | `KEEP_CUSTOM` | 保持核心产品能力 | DEFER | check-types、package、extension smoke |
| C-011 | TUI localization/UX | `packages/tui/src/**` | 中文化、语言切换、HyperCode 提示和交互 | Upstream TUI 结构可复用但无中文产品层 | 29 paths | 9 | medium | `KEEP_CUSTOM` | 面向中国用户的体验 | P1 | TUI typecheck/tests |
| C-012 | Offline delivery | `script/build-offline-*.ts`, `packages/opencode/script/offline-*` | Linux/Windows 离线包构建 | Upstream无同等 HyperCode delivery workflow | 15 paths | 10 | high | `KEEP_CUSTOM` | 支持受限网络交付 | P1 | offline build in clean env |
| C-013 | License runtime | `packages/opencode/src/license/**`, `sdks/vscode/src/license/**` | license 生成、校验、machine identity | Upstream status unknown；现有 CLI/VS Code/tests 有消费者 | 5+ paths | 12 | high | `NEEDS_REVIEW` | 明确产品决策后再处理 | DEFER | product decision + license tests |
| C-014 | Video replica workflow | workflow/skill/tool 相关新增文件 | 豆包视频复刻、图像生成、checkpoint orchestration | 未找到 upstream 等价入口；动态 provider/tool 依赖未完成调用图 | unknown | 11 | high | `NEEDS_REVIEW` | 避免误删实验/交付能力 | DEFER | call graph + runtime smoke |
| C-015 | Repo agents/skills/commands | `.opencode/agent`, `.opencode/skills`, `.opencode/command` | filesystem discovery 的仓库级工作流 | Upstream discovery 机制存在，但内容为 HyperCode 产品规则 | 11 prompt-like paths | 7 | medium | `KEEP_CUSTOM` | 保留团队工作流 | P2 | discovery tests |
| C-016 | VS Code/CLI compatibility wrappers | `sdks/vscode/src/core`, `packages/opencode/src/brand.ts` | 内部 opencode IDs 与公开 HyperCode 入口之间适配 | Upstream ID/API 不同；无法仅凭名称判定可删除 | 43+ paths | 10 | high | `PARTIAL_UPSTREAM_REPLACEMENT` | 在边界集中兼容逻辑 | P1 | extension/server protocol matrix |

## Priority Rule

- `P0`：0 个。当前验证环境不可用，且没有同时满足低价值、高成本、强证据的候选。
- `P1`：C-001、C-002、C-006、C-007、C-010、C-011、C-012、C-016。
- `P2`：C-003、C-005、C-008、C-009、C-015。
- `DEFER`：C-004、C-013、C-014。

任何候选进入 Phase 5 前，都必须补齐对应验证；本阶段不执行 disposition。

## Dead Code / Dependency Audit

- `HIGH_CONFIDENCE_DEAD`：0。检查范围包含静态 import、动态 import、字符串命令注册、filesystem discovery、public exports、scripts、CI 和 tests；缺少可运行依赖时不把“未被 rg 命中”当作 dead code 证据。
- `POSSIBLE_DEAD`：2 组：`packages/opencode/script/trace-imports.ts` 与部分 video workflow 入口；二者均可能被直接命令或外部流程调用，列为 `NEEDS_REVIEW`。
- `RUNTIME_DYNAMIC_UNKNOWN`：`.opencode/agent`、`.opencode/skills`、`.opencode/command`、plugin discovery、VS Code parity fixtures；保持 `KEEP`。
- `HIGH_CONFIDENCE_UNUSED_DEP`：0。未执行删除；lockfile 安装失败使全局 consumer scan 延后。
- 语义重复实现：2 组已确认（env alias parsing、品牌 hardcode/resource）；对应 C-001/C-009，建议 Phase 5 先补测试再 `MERGE_DUPLICATES`/`SIMPLIFY_CUSTOM`。
