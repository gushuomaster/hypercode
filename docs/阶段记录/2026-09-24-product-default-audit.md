# HyperCode Product Default Audit - 2026-09-24

## 目的与边界

本记录是 [Product Default Policy Design](../superpowers/specs/2026-09-24-product-default-policy-design.md) 的首批审计基线。它记录当前代码证据与本轮决策，不创建新的架构 Phase，也不把 upstream 默认值自动判定为缺陷。

本轮只实施已经明确批准的 LSP 决策。Formatter、MCP、更新、模型目录、Skill/Plugin 等能力即使在矩阵中完成现状审计，也不会在没有独立产品决策时顺手修改 runtime default。

## 分类与同步结论

默认分类：

- `default_on_lazy`：默认提供核心能力，仅在相关场景按需激活；
- `default_on_passive`：默认提供低副作用的观察或状态能力；
- `environment_managed`：能力有价值，但联网、安装或可用性由交付 profile 约束；
- `explicit_opt_in`：外部披露、付费、高影响授权或其他显著副作用必须显式选择；
- `explicit_unsupported`：Host 不具备能力，必须如实报告。

同步结论：`ACCEPT_UPSTREAM_DEFAULT`、`PRESERVE_HYPERCODE_DEFAULT`、`PROFILE_SPECIFIC_DEFAULT`、`NEEDS_HUMAN_DECISION`。

## 首批审计矩阵

| 能力 | 当前 omitted / override 行为 | 分类 | 同步结论 | 本轮动作 |
| --- | --- | --- | --- | --- |
| LSP analysis | 当前 omitted 为关闭；`false` 关闭；`true` 启用内置服务器；对象启用内置服务器并应用覆盖 | `default_on_lazy` | `PRESERVE_HYPERCODE_DEFAULT` | 将 omitted 解析为启用；保留显式 `false`、`true` 和对象 |
| LSP dependency download | 启用 LSP 后，缺少的部分服务器可自动下载；`OPENCODE_DISABLE_LSP_DOWNLOAD=1` 禁止下载 | `environment_managed` | `PROFILE_SPECIFIC_DEFAULT` | online 保持允许；offline/controlled 禁止下载但不关闭本地 LSP |
| Formatter | omitted/`false` 关闭；`true` 启用内置 formatter；对象启用并覆盖 | 尚未定案 | `NEEDS_HUMAN_DECISION` | 不修改；需先区分诊断价值与自动文件修改副作用 |
| Configured MCP activation | 未配置时不启动；已配置 entry 默认连接；entry `enabled: false` 时禁用 | 尚未定案 | `NEEDS_HUMAN_DECISION` | 不修改；配置服务器是否等同于同意自动连接需要独立决策 |
| Model catalog refresh | 有缓存/内置 snapshot 时使用本地数据；允许时后台每 60 分钟刷新；`OPENCODE_DISABLE_MODELS_FETCH=1` 禁止公网刷新 | `environment_managed` | `PROFILE_SPECIFIC_DEFAULT` | 保持 online/offline 现状，不修改 runtime |
| Automatic update | omitted 时会检查更新，并可自动应用 patch；`false` 或 `OPENCODE_DISABLE_AUTOUPDATE=1` 禁用；非 patch 默认通知 | `environment_managed` | `PROFILE_SPECIFIC_DEFAULT` | 保持 online/offline 现状，后续单独评估 managed/enterprise policy |
| Session sharing | omitted 允许用户手工触发 share，但不自动分享；`auto` 自动分享；`disabled` 禁止分享 | `explicit_opt_in` | `ACCEPT_UPSTREAM_DEFAULT` | 保持，用户动作才产生数据披露 |
| Telemetry | AI SDK telemetry 仅在 `experimental.openTelemetry` 显式开启；OTLP export 仅在 endpoint 环境变量存在时启动 | `explicit_opt_in` | `ACCEPT_UPSTREAM_DEFAULT` | 保持显式启用，不修改 |
| Permission auto-approval | 当前 agent 对多数工作区内工具默认 `allow`，敏感文件、外部目录和 doom loop 为 `ask`；用户可配置覆盖 | `explicit_opt_in` | `NEEDS_HUMAN_DECISION` | 不修改；“多数工具默认 allow”与严格 opt-in 原则存在产品张力，需独立权限审计 |
| Paid model selection | Product 按 override、agent、configured、recent、provider default、provider-first 回退；fallback 不保证免费模型 | `explicit_opt_in` | `NEEDS_HUMAN_DECISION` | 不修改；需设计可见的价格/确认语义，不能仅靠排序解决 |
| Installed Skill/Plugin loading | 已发现或显式配置的本地插件/Skill 可加载；部分目录会安装 plugin SDK 依赖；远程 Skill URL 和新包安装是额外网络边界 | 尚未定案 | `NEEDS_HUMAN_DECISION` | 不修改；必须分开“加载已安装代码”和“下载新代码” |

## LSP 决策证据

- `packages/opencode/src/lsp/lsp.ts` 仅在第一次读取 LSP state 时构建 server catalog；实际 client 仍由匹配文件触发，满足 lazy activation。
- `packages/opencode/src/lsp/server.ts` 在各内置服务器的安装路径检查 `disableLspDownload`，因此启用分析和允许下载是可分离策略。
- `packages/opencode/src/config/config.ts` 是所有 global/project/env/managed 层完成合并的位置；默认值必须在最终 merge 后解析，不能作为低优先级配置提前合入，否则可能覆盖显式 `false`。
- `script/translate-app.ts` 的 `lsp: false` 是翻译任务隔离外部进程和副作用的显式配置，不属于产品 omission default，必须保留。
- TUI 和 VSCode 都通过各自 adapter 调用 `packages/product/src/lsp.ts`，Product 继续拥有排序、severity 和 error text key；Core 继续拥有进程、文件匹配、下载和 raw status。

## 迁移

不写入或改写用户配置。升级后只有完全省略 `lsp` 的用户从关闭变为默认按需启用；显式 `lsp: false` 的用户行为不变，显式 `true` 和对象配置也保持原义。

## 实施结果

本轮完成以下行为闭环：

- 最终配置合并后，省略 `lsp` 解析为 `true`；显式 `false`、`true` 和 server override 对象保持原义。
- LSP server catalog 仍延迟构建，具体 server 仍只在处理匹配文件时启动；默认启用不等于启动时预热全部 server。
- offline Linux/Windows 交付设置 `OPENCODE_DISABLE_LSP_DOWNLOAD=1`，只禁止公网依赖下载，不关闭本地可用的 LSP。
- Core 在 LSP 启动失败后返回协议已有的 `status: "error"` 并发布 `lsp.updated`；没有扩展 Protocol 或 Server `HttpApi`。
- TUI 和 VSCode adapter 对相同 connected/error fixture 产生相同 Product 投影；共享错误语义为 `error.lsp.connection_failed`，raw diagnostic 继续由 Core/Host 保留。
- TUI status dialog 和 footer 消费 Product LSP 投影，不在 Host 重新判断错误优先级或文案语义。
- 中英文 LSP 文档均已更新为 HyperCode 的默认启用、按需启动和下载策略。

`script/translate-app.ts` 中的 `lsp: false` 明确保留。它是翻译任务隔离外部进程与副作用的任务级策略，不是产品 omission default。

## 验证基线

2026-09-24 在 Windows / PowerShell / Bun `1.3.14` 上重新执行：

```text
Product full                    62 pass / 0 fail
Product typecheck               pass
Core config + LSP + offline    186 pass / 0 fail
LSP config focused               3 pass / 0 fail
LSP full                        60 pass / 0 fail
Offline package                  5 pass / 0 fail
TUI Product adapter             31 pass / 0 fail
TUI typecheck                   pass
VSCode Product adapter           9 pass / 0 fail
VSCode check-types              pass
VSCode package                  pass
git diff --check                pass
```

全量测试与既有 [Product Alignment Maintenance Baseline](../superpowers/specs/2026-09-24-product-alignment-maintenance-baseline.md) 对比：

- TUI full：`243 pass / 4 known fail / 1 skip`，失败身份和旧基线一致：过期的 `opencode` 品牌断言、两个 Windows path/session continuation 断言，以及环境敏感的 DiffViewer empty-state 断言。
- VSCode full：`406 pass / 29 known fail / 18 known errors`，失败身份和旧基线一致：缺少运行时 `vscode`、CSS animation 断言、autocomplete parity fixtures 和 malformed timeline fixture。
- 本轮没有新增 Product Default 或 LSP 回归；全量 suite 仍不是全绿声明。

`packages/opencode` 全包 `bun typecheck` 仍失败，错误集合属于实施前已知债务：

- `script/run-real-doubao.ts` 引用已删除的 skill runtime 模块、旧 layer API，并有连带 implicit `any`；
- `test/config/config.test.ts:284` 的 `Option` fixture 类型不匹配；
- `test/script/windows-validation-build.test.ts:16` 的环境变量 fixture 类型过窄。

本轮修改文件没有出现在该 typecheck 错误集合中。该事实只证明本轮未扩展错误集合，不将 Core 全包 typecheck 记为通过。

## Fork Tax

需要在未来 upstream synchronization 中持续审查的 downstream surface：

| 路径 | 维护责任 |
| --- | --- |
| `packages/opencode/src/config/config.ts` | 在最终 merge 后解析 HyperCode LSP omission default，避免覆盖显式 `false` |
| `packages/core/src/v1/config/config.ts` | 描述 HyperCode 的默认启用与显式关闭语义 |
| `packages/opencode/src/lsp/lsp.ts` | 保留 lazy activation，并将启动失败投影为现有 `error` status |
| `packages/opencode/script/offline-package.ts` | Linux offline profile 禁止 LSP 依赖下载 |
| `packages/opencode/script/offline-windows-package.ts` | Windows offline installer 同时设置持久和当前进程下载策略 |
| `packages/tui/src/component/dialog-status.tsx`、`packages/tui/src/routes/session/footer.tsx` | 只渲染共享 Product LSP error projection |
| `packages/web/src/content/docs/lsp.mdx`、`packages/web/src/content/docs/zh-cn/lsp.mdx` | 维护 HyperCode 中英文用户行为说明 |

同步时必须分别审查“分析是否启用”“何时启动 server”“是否允许下载”“失败如何投影”，不能把它们重新合并成一个布尔开关。TUI/VSCode 仍不得各自实现 LSP availability、severity、状态优先级或错误语义。

## 最终状态

```text
NEW_REGRESSION=0
LSP_OMISSION_DEFAULT=ENABLED_LAZY
LSP_EXPLICIT_FALSE=PRESERVED
OFFLINE_LSP_DOWNLOAD=DISABLED
TUI_VSCODE_PRODUCT_PARITY=PRESERVED
PROTOCOL_HTTPAPI_UNCHANGED
GENERATED_CLIENT_UNCHANGED
```

Formatter、configured MCP、权限默认、付费模型选择和 Skill/Plugin 下载边界仍维持矩阵中的 `NEEDS_HUMAN_DECISION`，没有被本轮 LSP 决策隐式改写。
