# Phase 4.6 Validation Failure Ledger

## 判定规则

本台账区分环境阻塞、依赖级联、测试假设和同步引入回归。A/B worktree 未完成 runtime 安装，因此不对 pure upstream 或 pre-sync 的运行时结果作推断。

## Failure Clusters

### F-001 — 在线 registry manifest 超时

- **Command**：`bun install --frozen-lockfile --verbose`
- **Package**：workspace root
- **Area**：dependency installation
- **Failure signature / first relevant error**：`aws4fetch`、`@storybook/addon-docs` manifest 多次 timeout，安装停留在最后任务。
- **Affected file(s)**：无 tracked file；中断后无持久化项目改动。
- **Reproducible**：是，在当前网络条件下可复现。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试；A/B 离线安装另有 hardlink blocker。
- **Environment dependent**：是。
- **Classification / confidence**：`ENVIRONMENT_NETWORK_FAILURE` / 高。
- **Evidence**：registry 请求可达但部分 manifest 超时；offline frozen install 可完成。
- **Recommended action**：保留网络诊断；不要改依赖、manifest 或 lockfile。

### F-002 — A/B worktree Bun hardlink 目标缺失

- **Command**：`bun install --frozen-lockfile --offline`
- **Package**：pure upstream `upstream-1.18.30-audit`、pre-sync `pre-sync-hypercode-audit`
- **Area**：dependency installation
- **Failure signature / first relevant error**：`Hardlinking ... to a path that doesn't exist`，例如 `node_modules/.bun/husky@9.1.7/node_modules/husky/bin.js`。
- **Affected file(s)**：A/B worktree 的临时 `node_modules`；tracked files 未改动。
- **Reproducible**：是（两套 A/B worktree 均停在 Resolving/install linking）。
- **Occurs on HyperCode post-sync**：未观察到同一 hardlink 错误；post-sync 已有可用 node_modules。
- **Occurs on pure upstream / pre-sync HyperCode**：是。
- **Environment dependent**：是，Windows/Bun hardlink/cache 状态相关。
- **Classification / confidence**：`ENVIRONMENT_FAILURE` / 高。
- **Evidence**：短时 verbose 日志直接指向不存在的 hardlink target；两 worktree 状态无改动。
- **Recommended action**：修复 Bun/缓存/权限环境后重试；Phase 5 不得把 A/B 当作 PASS。

### F-003 — Drizzle peer variant 不完整

- **Command**：`bun install --frozen-lockfile --offline`、构建后的模块解析
- **Package**：workspace root / `packages/core`
- **Area**：dependency layout
- **Failure signature / first relevant error**：`drizzle-orm@1.0.0-rc.2+acca00...` 缺少 `sql/sql.js`、`sql/expressions/*.js`、`sqlite-core/*.js`。
- **Affected file(s)**：`node_modules/.bun/drizzle-orm@...`（非 tracked）。
- **Reproducible**：部分可复现；中断 install 后残缺 variant 可见，offline relink 结果不稳定。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试，A/B 安装先被 F-002 阻断。
- **Environment dependent**：是，可能由 Bun 中断安装残留或 peer layout 触发。
- **Classification / confidence**：`DEPENDENCY_VARIANT_FAILURE` / 中。
- **Evidence**：cache 中同版本完整 tarball 存在；`--force --offline` 也曾停滞。
- **Recommended action**：单独修复安装环境并复测；禁止改 lockfile/依赖版本迁就。

### F-004 — Drizzle 解析错误向 Core/OpenCode/TUI 级联

- **Command**：`packages/core bun typecheck`、`packages/opencode bun typecheck`、`packages/tui bun typecheck`
- **Package**：core、opencode、tui
- **Area**：typecheck
- **Failure signature / first relevant error**：大量 `Cannot find module 'drizzle-orm/...` 与 Drizzle 类型错误。
- **Affected file(s)**：多个 package 源文件；没有证据表明业务源代码是根因。
- **Reproducible**：是，在当前残缺依赖布局下。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：是，依赖 F-003。
- **Classification / confidence**：`DEPENDENCY_VARIANT_CASCADE` / 高（级联关系）；根因置信度中。
- **Evidence**：三个 package 首要错误集中于同一 Drizzle variant；App typecheck 可通过。
- **Recommended action**：按 F-003 处理，暂不改业务代码。

### F-005 — TUI Windows 路径分隔符断言

- **Command**：`packages/tui bun test --timeout 30000 --only-failures`
- **Package**：tui
- **Area**：path rendering test
- **Failure signature / first relevant error**：expected `~/project`，received `~\\project`。
- **Affected file(s)**：TUI 相关历史测试/路径格式断言。
- **Reproducible**：是，Windows 环境稳定复现。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：是，Windows separator。
- **Classification / confidence**：`TEST_ASSUMPTION_FAILURE` / 高。
- **Evidence**：失败测试由 pre-sync 历史提交引入；post-sync 未修改对应实现。
- **Recommended action**：Phase 5 保留平台断言 guardrail；不为此改路径业务语义。

### F-006 — TUI 品牌断言仍期待 opencode

- **Command**：同 F-005
- **Package**：tui
- **Area**：branding assertion
- **Failure signature / first relevant error**：测试期待 `opencode -s ...`，实现返回 `hypercode -s ...`。
- **Affected file(s)**：TUI 测试断言与品牌化实现。
- **Reproducible**：是。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：否（产品文案假设）。
- **Classification / confidence**：`HYPERCODE_PRE_EXISTING_FAILURE` / 高。
- **Evidence**：品牌差异在 sync 前已存在；post-sync 未修改对应实现。
- **Recommended action**：不删除品牌层；Phase 5 仅补中文/品牌测试。

### F-007 — Config LayerNode migration 残留

- **Command**：`packages/opencode bun test --timeout 30000 test/config/config.test.ts`
- **Package**：opencode config
- **Area**：test layer setup
- **Failure signature / first relevant error**：`testFlock is not defined`、`infra is not defined`、`*.defaultLayer` undefined。
- **Affected file(s)**：`packages/opencode/test/config/config.test.ts`
- **Reproducible**：是（修复前）；修复后 118 pass / 0 fail。
- **Occurs on HyperCode post-sync**：是，来自同步 API 迁移不完整。
- **Occurs on pure upstream / pre-sync HyperCode**：未以同样 post-sync 状态运行。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：sync diff 删除旧 layer API 但保留引用；替换为 `LayerNode.compile(...)` 后 targeted test 全绿。
- **Recommended action**：已修复；纳入 repair report。

### F-008 — xAI OAuth helper 定义被同步删除

- **Command**：`packages/opencode bun typecheck`、`bun test --timeout 30000 test/plugin/xai.test.ts`
- **Package**：opencode plugin
- **Area**：xAI OAuth
- **Failure signature / first relevant error**：`Cannot find name 'escapeHtml'`、`PkceCodes`、`createServer`、`OAUTH_PORT` 等。
- **Affected file(s)**：`packages/opencode/src/plugin/xai.ts`
- **Reproducible**：是（修复前）；修复后 xAI 24 pass / 0 fail。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：upstream 没有 HyperCode loopback OAuth，不能作失败等价比较。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：post-sync 保留 helper 使用点和 callback server，顶部定义被冲突解析删除；从 pre-sync 恢复后测试通过。
- **Recommended action**：已修复；后续仅做 plugin 级 slimming 评估。

### F-009 — Session processor V2 stale step-start emission

- **Command**：`packages/opencode bun test --timeout 30000 test/session/processor-effect.test.ts`
- **Package**：opencode session
- **Area**：legacy V2 event emission
- **Failure signature / first relevant error**：`session.next.step.started`，测试要求无 `session.next.*`。
- **Affected file(s)**：`packages/opencode/src/session/processor.ts`
- **Reproducible**：是（修复前 15 pass / 2 fail）；修复后 17 pass / 0 fail。
- **Occurs on HyperCode post-sync**：是，同步提交保留 stale `step-start` 调用。
- **Occurs on pure upstream / pre-sync HyperCode**：upstream commit 已明确停止 legacy V2 emission；A/B runtime 未执行。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：upstream `a1f093a74` 删除 legacy emission；只删除残留调用即可恢复测试。
- **Recommended action**：已修复；session 仍列高风险，不进入 slimming。

### F-010 — Plugin loader 旧 layer 引用残留

- **Command**：`packages/opencode bun test --timeout 30000 test/plugin/loader-shared.test.ts`
- **Package**：opencode plugin
- **Area**：plugin layer wiring
- **Failure signature / first relevant error**：旧 `Plugin.layer` / `EventV2Bridge.defaultLayer` 引用与新 LayerNode API 不匹配。
- **Affected file(s)**：`packages/opencode/test/plugin/loader-shared.test.ts`
- **Reproducible**：是（修复前）；修复后 29 pass / 0 fail。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：同一同步 diff 已迁移大部分 block，单块残留旧 API；改为 `LayerNode.compile` 后全绿。
- **Recommended action**：已修复。

### F-011 — Share-next 变量重命名残留

- **Command**：`packages/opencode bun test --timeout 30000 test/share/share-next.test.ts`
- **Package**：opencode share
- **Area**：test assertion bookkeeping
- **Failure signature / first relevant error**：`seen.filter(...)`，但变量已重命名为 `createRequests`。
- **Affected file(s)**：`packages/opencode/test/share/share-next.test.ts`
- **Reproducible**：是（修复前）；修复后 7 pass / 0 fail。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：同步重命名未覆盖过滤表达式；最小变量修复后 targeted test 全绿。
- **Recommended action**：已修复。

### F-012 — Compaction 测试缺失 SessionStatus node

- **Command**：`packages/opencode bun test --timeout 30000 test/session/compaction.test.ts`
- **Package**：opencode session
- **Area**：LayerNode test environment
- **Failure signature / first relevant error**：compaction 环境缺少 `SessionStatus.Service`。
- **Affected file(s)**：`packages/opencode/test/session/compaction.test.ts`
- **Reproducible**：是（修复前）；修复后 55 pass / 1 skip / 0 fail。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：同步迁移到 LayerNode 后依赖集合漏掉 `SessionStatus.node`；补 node 后全绿。
- **Recommended action**：已修复。

### F-013 — Config Npm Option 类型不匹配

- **Command**：`packages/opencode bun typecheck`
- **Package**：opencode config test
- **Area**：test fake typing
- **Failure signature / first relevant error**：`Effect<Option<never>>` 不能赋给 `Effect<string | undefined>`。
- **Affected file(s)**：`packages/opencode/test/config/config.test.ts`
- **Reproducible**：是。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：否。
- **Classification / confidence**：`HYPERCODE_PRE_EXISTING_FAILURE` / 中高。
- **Evidence**：错误位于 pre-sync 历史测试 fake；config targeted runtime 已全绿，且与本阶段同步修复无关。
- **Recommended action**：记录并暂不修改，避免扩大 scope。

### F-014 — VS Code message error union 不兼容（已修复）

- **Command**：`sdks/vscode bun run check-types`
- **Package**：vscode SDK
- **Area**：message model API
- **Failure signature / first relevant error**：`ContentFilterError` 不能赋给旧 `MessageError` union。
- **Affected file(s)**：`sdks/vscode/src/**` 中消息类型消费点。
- **Reproducible**：是。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试，A/B 被 F-002 阻断。
- **Environment dependent**：可能，需先完成 A/B baseline。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：上游提交 `e2527db3c7` 将 `ContentFilterError` 加入 SDK v2 `AssistantMessage.error`；HyperCode 的 VS Code adapter 在 pre-sync 已有本地 `MessageError` union，但未包含该成员。补充同形状本地类型并加入 union 后 `sdks/vscode bun run check-types` 通过。
- **Recommended action**：已完成最小同步修复；仍需保留 VS Code 行为回归门禁，不进行 slimming。

### F-015 — Processor event assertion mismatch（已消除）

- **Command**：同 F-009
- **Package**：opencode session
- **Area**：event assertions
- **Failure signature / first relevant error**：两个测试收到 `session.next.step.started` 而非空数组。
- **Affected file(s)**：同 F-009
- **Reproducible**：是；修复后消失。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：否。
- **Classification / confidence**：`SYNC_INTRODUCED_REGRESSION` / 高。
- **Evidence**：与 F-009 同一 stale call；17/17 targeted pass。
- **Recommended action**：合并到 F-009 的 repair，不另行修改测试。

### F-016 — Broad test failures（级联已拆分）

- **Command**：`packages/core bun test --only-failures`、`packages/opencode bun test --only-failures`、`packages/tui bun test --only-failures`
- **Package**：core、opencode、tui
- **Area**：broad validation
- **Failure signature / first relevant error**：重新安装并完成依赖链接后，Core 为 `1089 pass / 7 skip / 4 fail`，OpenCode 为 `3607 pass / 58 skip / 1 todo / 7 fail`，TUI 为 `195 pass / 1 skip / 3 fail`。旧的 `269/110/108` 与 `457/205/204` 计数属于残缺 Drizzle variant 期间的级联结果。
- **Affected file(s)**：多个测试；多数错误与 F-003/F-004 相关。
- **Reproducible**：是，但结果依赖 node_modules 状态。
- **Occurs on HyperCode post-sync**：是。
- **Occurs on pure upstream / pre-sync HyperCode**：未测试。
- **Environment dependent**：是。
- **Classification / confidence**：`BASELINE_PLATFORM_OR_FIXTURE_FAILURE` / 高（已观测项目级首错）；A/B 责任仍受 hardlink blocker 限制。
- **Evidence**：Drizzle 级联消失；Core 首错为 npm fake timeout、Windows shell 解析、legacy config fixture、Windows `echo` 输出；OpenCode 为 6 个 Windows symlink `EPERM` 与 1 个 CLI help 空格快照差异；TUI 仅为 Windows separator 与 HyperCode branding 断言。targeted config/plugin/share/compaction/processor/xAI 均独立通过。
- **Recommended action**：不修改业务代码或测试迁就环境；Phase 5 仅允许只读分析和有独立验证的低风险同步修复。
