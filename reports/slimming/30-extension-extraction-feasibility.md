# Phase 4.7 Extension Extraction Feasibility

本报告只判断静态边界，不执行迁移。`STATIC_FEASIBLE` 不等于已获 Phase 5 删除授权。

## Plugin Candidates

| Candidate | Required symbols | Public/private boundary | Hooks | Cyclic dependency | Feasibility | Expected future effect | Runtime validation |
|---|---|---|---|---|---|---|---|
| xAI OAuth (`C-007`) | `XaiAuthPlugin`、PKCE、callback server、auth persistence、`OAUTH_DUMMY_KEY` | PluginInput/public hooks可用；auth storage和部分 constants来自 opencode internal | auth、fetch、event 可用 | 低到中 | `STATIC_PARTIAL` | 可把 254-line provider flow 从 core sync path 隔离 | OAuth mock、loopback、state/error、token refresh |
| Provider metadata/compat (`C-006`) | `fromModelsDevProvider`、custom loaders、Provider.Info/Model | Provider service和 custom dependency 多为 internal | provider registration hook 不完整 | 中 | `STATIC_PARTIAL` | 可能缩小 provider.ts patch，不能承诺移出 core | provider matrix、model discovery、fallback |
| MCP auth/command adapters | MCP service、OAuth provider、Brand command | MCP service internal；plugin API不能直接替换 server command lifecycle | plugin/event 部分可用 | 中 | `STATIC_NOT_FEASIBLE` | 先集中 Brand/resource，不先抽 MCP core | OAuth callback、remote/local MCP matrix |
| VS Code runtime adapter (`C-010/C-016`) | server launch、workspace、SDK v2 client、message types | SDK/protocol public；workspace server lifecycle和路径处理 internal | extension host hooks可用 | 中 | `STATIC_PARTIAL` | adapter package可降低主仓耦合，但产品面仍保留 | check-types、server protocol、extension smoke |

## Package Candidates

| Candidate | Required APIs | Hook/config injection | Feasibility | Expected future effect | Runtime validation |
|---|---|---|---|---|---|
| Env/Brand compatibility package | `Flag`、runtime flag schema、Brand constants | 目前通过直接 imports 注入；可设计 package boundary | `STATIC_PARTIAL` | 集中 alias/brand，减少约 20+ thin patches | precedence、startup、CLI/help、provider IDs |
| Config compatibility package | config filenames、Global.Path、FSUtil、schema normalization | Config layer有 service，但 bundled bootstrap依赖 internal state | `STATIC_PARTIAL` | 减少 `config.ts`/core config overlap | fresh-home、global/project priority、migration |
| Offline delivery package | offline target、model fixture、license skip、platform compilers | root/package scripts显式调用 | `STATIC_FEASIBLE`（边界层） | 将 packaging 维护面与 runtime core 分开 | clean Linux/Windows artifact build |
| OAuth callback utility package | escape HTML、CORS/callback page、state helpers | core/oauth/page 已提供部分基础 | `STATIC_PARTIAL` | 减少 xAI/Codex/DigitalOcean page duplication | callback security、provider-specific error |

## Agent / Skill Candidates

| Candidate | Required symbols | Feasibility | Expected future effect | Runtime validation |
|---|---|---|---|---|
| Video replica workflow | filesystem assets、image/video tools、checkpoint orchestration | `STATIC_PARTIAL` | 可继续保持 workflow/skill surface，不侵入 core | end-to-end artifact workflow |
| Rebrand/sync audit instructions | Git/upstream refs、report templates | `STATIC_FEASIBLE` as skill/documentation | 已基本位于 scripts/docs，不应迁回 runtime | dry-run on clean clone |
| Repo agents/skills/commands | discovery directories、prompt schema | `STATIC_NOT_FEASIBLE` to replace with plugin | filesystem discovery是产品工作流契约 | discovery tests and command smoke |

## VS Code Message Union Static Map

- 定义：`sdks/vscode/src/core/sdk.ts:MessageError` 当前包含 `ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError | StructuredOutputError | ContextOverflowError | ApiError`。
- Upstream SDK v2：`packages/sdk/js/src/v2/gen/types.gen.ts` 的 `AssistantMessage.error` 额外包含 `ContentFilterError`。
- Producer：OpenCode V2 session/message schemas 与 `Session.Event.Error` 可产生 `ContentFilterError`。
- Consumers：`sdks/vscode/src/core/sdk.ts` 的 `SessionEvent`、panel reducer/controller、timeline `assistantErrorText` 和 tests 消费该 union。
- 静态结论：这是 version/API shape skew，非 branding 或 dead code；分类 `UNKNOWN_RUNTIME_DEPENDENCY`，不能修复或删除 union 成员于本阶段。

## TUI Static Map

- 产品差异：`src/i18n/*`、`context/language`、语言 dialog、中文提示、HyperCode title/logo。
- upstream overlap：`app.tsx`、prompt autocomplete/index、tips、diff viewer、permission/location/spinner wiring。
- thin patches：`app.tsx` title/command labels、tips labels、diff labels；但语言 context 与 agent mention 是跨组件 behavior patch。
- legacy：`opencode` command/help strings和路径 separator assumptions仍在 tests/compat boundaries。
- 结论：可静态拆出 product/localization 与 upstream UI plumbing；TUI broad runtime 仍 `RUNTIME_REQUIRED`。

## Session Freeze

涉及 `SessionProcessor`、`Session.layer`、message/tool lifecycle、stream/retry、snapshot、V2 event ordering 的所有 extraction feasibility 均为 `UNKNOWN` 或 `STATIC_PARTIAL`，不得标记 `STATIC_FEASIBLE`，不得进入删除队列。
