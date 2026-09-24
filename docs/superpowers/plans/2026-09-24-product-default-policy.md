# HyperCode Product Default Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可持续审计的 HyperCode 产品默认值治理，并将 LSP 调整为默认开启、按需启动，同时保持显式关闭和离线交付的无公网下载约束。

**Architecture:** Core/config 在所有配置源完成合并后解析 HyperCode runtime default，LSP runtime 继续拥有文件匹配、进程启动与下载行为；`packages/product` 继续拥有跨 TUI/VSCode 的 LSP 状态投影，Host 只消费投影。交付脚本通过环境变量区分在线与离线下载策略，治理文档和审计矩阵锁定其他能力的已验证决策，未经审计的能力不顺手改默认值。

**Tech Stack:** TypeScript, Bun test, Effect configuration services, Solid/OpenTUI adapters, React/VSCode adapters, Markdown governance documentation

**Spec:** `docs/superpowers/specs/2026-09-24-product-default-policy-design.md`

## Global Constraints

- 不修改 Protocol 或 Server `HttpApi`，不重生成 generated client。
- 不修改用户当前的 `hypercode.json`；默认值在最终配置投影中解析，显式 `lsp: false` 必须保留。
- LSP 分析默认开启但只在相关文件触发时启动；LSP 下载是独立的环境策略。
- 离线和受控交付设置 `OPENCODE_DISABLE_LSP_DOWNLOAD=1`；标准在线交付保持当前受控下载能力。
- LSP 缺失或启动失败保持可见、非阻断；Product 不拥有 LSP 进程或 raw protocol payload。
- TUI 与 VSCode 不重复实现默认值、状态优先级或错误语义。
- 不改 Formatter、MCP 或其他审计项的 runtime default，除非审计证据形成独立获批决策。
- 不做无关格式化、line-ending normalization、reset、stash、drop、工作区清理或 push。

---

### Task 1: 默认行为治理与首批审计基线

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/规范/上游同步工作流总纲.md`
- Modify: `docs/规范/上游同步与品牌化规范.md`
- Modify: `docs/操作手册/上游同步操作流程.md`
- Create: `docs/阶段记录/2026-09-24-product-default-audit.md`

**Interfaces:**
- Consumes: spec 中的五类默认值、九项判断维度和四类 upstream review 结论。
- Produces: 后续同步必须执行的 Product Default Review Gate，以及首批能力的 versioned maintenance baseline。

- [ ] **Step 1: 在根约束中加入简短规则**

在 HyperCode local overlay 中加入以下约束，保持 upstream 正文原样：

```markdown
**产品默认值。** 用户可感知能力的省略值必须经过 HyperCode Product Default Policy 判断，不能自动继承 upstream 语义。默认值按 `default_on_lazy`、`default_on_passive`、`environment_managed`、`explicit_opt_in`、`explicit_unsupported` 分类；能力启用与联网下载、外部披露、付费和破坏性授权必须分开审查。upstream 若改变 omission、默认开关、lazy activation、自动安装、联网、权限、分享、遥测、收费或跨宿主结果，必须执行产品默认值审查并记录结论。
```

- [ ] **Step 2: 将同步 gate 写入两份规范和操作流程**

规范必须要求对高风险 upstream diff 记录以下四选一结论：

```text
ACCEPT_UPSTREAM_DEFAULT
PRESERVE_HYPERCODE_DEFAULT
PROFILE_SPECIFIC_DEFAULT
NEEDS_HUMAN_DECISION
```

SOP 增加可执行检查：搜索 schema 描述、runtime fallback、installer/env template、TUI/VSCode projection 和相关测试；build/typecheck 通过不能替代产品默认值审查。

- [ ] **Step 3: 创建首批能力审计矩阵**

矩阵逐项记录 omitted/false/true/override、现状证据、policy class、在线/离线差异、迁移和宿主 parity。首版结论必须至少包括：

```text
LSP analysis              default_on_lazy       PRESERVE_HYPERCODE_DEFAULT
LSP dependency download  environment_managed   PROFILE_SPECIFIC_DEFAULT
session sharing           explicit_opt_in       ACCEPT_UPSTREAM_DEFAULT
telemetry                 explicit_opt_in       ACCEPT_UPSTREAM_DEFAULT
permission auto-approval  explicit_opt_in       ACCEPT_UPSTREAM_DEFAULT
paid model selection      explicit_opt_in       ACCEPT_UPSTREAM_DEFAULT
```

Formatter、configured MCP、skill/plugin loading、model catalog refresh 和 automatic update 若证据尚不足，记录 `NEEDS_HUMAN_DECISION` 或 profile-specific 现状，不改变 runtime。

- [ ] **Step 4: 验证文档闭环**

Run:

```powershell
rg -n "Product Default|default_on_lazy|PRESERVE_HYPERCODE_DEFAULT|PROFILE_SPECIFIC_DEFAULT|NEEDS_HUMAN_DECISION" AGENTS.md docs/规范 docs/操作手册 docs/阶段记录/2026-09-24-product-default-audit.md
git diff --check
```

Expected: 所有分类和 gate 均可定位；`git diff --check` 无 whitespace error。

- [ ] **Step 5: Commit**

```powershell
git add AGENTS.md docs/规范/上游同步工作流总纲.md docs/规范/上游同步与品牌化规范.md docs/操作手册/上游同步操作流程.md docs/阶段记录/2026-09-24-product-default-audit.md
git commit -m "docs: establish product default review gate"
```

### Task 2: LSP omission 的 HyperCode runtime default

**Files:**
- Modify: `packages/opencode/test/config/config.test.ts`
- Modify: `packages/opencode/src/config/config.ts`
- Modify: `packages/core/src/v1/config/config.ts`

**Interfaces:**
- Consumes: merged `ConfigV1.Info` where `lsp` is `undefined | false | true | Record<string, ConfigLSPV1.Server>`.
- Produces: `Config.Service.get()` returns `lsp: true` only when every effective config source omitted `lsp`; explicit `false`, `true`, and object overrides remain unchanged.

- [ ] **Step 1: Write failing omission/override tests**

Add focused cases beside the existing LSP config test:

```ts
configIt()("enables LSP when all config layers omit the setting", () =>
  Effect.gen(function* () {
    expect((yield* Config.use.get()).lsp).toBe(true)
  }),
)

configIt({ config: { lsp: false } })("preserves an explicit LSP disable", () =>
  Effect.gen(function* () {
    expect((yield* Config.use.get()).lsp).toBe(false)
  }),
)

configIt({ config: { lsp: { typescript: { disabled: true } } } })("preserves LSP server overrides", () =>
  Effect.gen(function* () {
    expect((yield* Config.use.get()).lsp).toEqual({ typescript: { disabled: true } })
  }),
)
```

Use the exact valid server override shape accepted by `ConfigLSPV1.Info` if the fixture requires additional fields.

- [ ] **Step 2: Run the tests and verify RED**

Run from `packages/opencode`:

```powershell
bun test test/config/config.test.ts --test-name-pattern "LSP"
```

Expected: omitted-setting case fails because `config.lsp` is `undefined`; explicit cases pass.

- [ ] **Step 3: Implement the minimal merged-config default**

Immediately before `loadInstanceState` returns its final state, after all global/project/managed/env layers and compatibility transforms have merged:

```ts
result.lsp ??= true
```

Do not put this in `loadConfig()`, bundled config serialization, or user config writes, because lower-precedence defaults must not override a later explicit `false`.

Update the `ConfigV1.Info` LSP description so it states that HyperCode omission enables built-ins lazily and `false` disables them; do not change the field shape.

- [ ] **Step 4: Run focused and package verification**

Run from `packages/opencode`:

```powershell
bun test test/config/config.test.ts --test-name-pattern "LSP"
bun test test/lsp
bun typecheck
```

Expected: all commands pass; existing fixtures that explicitly use `lsp: false` remain isolated and unchanged.

- [ ] **Step 5: Commit**

```powershell
git add packages/opencode/test/config/config.test.ts packages/opencode/src/config/config.ts packages/core/src/v1/config/config.ts
git commit -m "fix(opencode): enable LSP lazily by default"
```

### Task 3: 离线交付禁止 LSP 依赖下载

**Files:**
- Modify: `packages/opencode/test/script/offline-package.test.ts`
- Modify: `packages/opencode/script/offline-package.ts`
- Modify: `packages/opencode/script/offline-windows-package.ts`

**Interfaces:**
- Consumes: existing offline Linux environment template and Windows installer environment setup.
- Produces: both offline profiles set `OPENCODE_DISABLE_LSP_DOWNLOAD=1` without disabling LSP analysis itself.

- [ ] **Step 1: Write failing archive assertions**

Extend the existing real-archive tests:

```ts
expect(environmentText).toContain("export OPENCODE_DISABLE_LSP_DOWNLOAD=1")
expect(readme).toContain("OPENCODE_DISABLE_LSP_DOWNLOAD=1")
expect(installerText).toContain('[Environment]::SetEnvironmentVariable("OPENCODE_DISABLE_LSP_DOWNLOAD", "1", "User")')
expect(installerText).toContain('$env:OPENCODE_DISABLE_LSP_DOWNLOAD = "1"')
```

Read `config/hypercode.env.example` from the Linux tar in the same way the test already reads its README. Keep PowerShell parser verification enabled.

- [ ] **Step 2: Run the packaging test and verify RED**

Run from `packages/opencode`:

```powershell
bun test test/script/offline-package.test.ts
```

Expected: new Linux and Windows assertions fail because the variable is absent.

- [ ] **Step 3: Add the profile-specific environment policy**

Linux template:

```sh
export HYPERCODE_DISABLE_MODELS_FETCH=1
export OPENCODE_DISABLE_LSP_DOWNLOAD=1
```

Windows installer:

```powershell
[Environment]::SetEnvironmentVariable("OPENCODE_DISABLE_LSP_DOWNLOAD", "1", "User")
$env:OPENCODE_DISABLE_LSP_DOWNLOAD = "1"
```

Update the offline README text to explain that LSP remains enabled for locally available servers while public dependency download is blocked.

- [ ] **Step 4: Run packaging verification**

Run from `packages/opencode`:

```powershell
bun test test/script/offline-package.test.ts
bun typecheck
```

Expected: generated Linux archive contents, generated Windows PowerShell syntax, and typecheck all pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/opencode/test/script/offline-package.test.ts packages/opencode/script/offline-package.ts packages/opencode/script/offline-windows-package.ts
git commit -m "fix(opencode): disable LSP downloads in offline builds"
```

### Task 4: Product LSP parity and user documentation

**Files:**
- Modify: `packages/product/test/lsp.test.ts`
- Modify: `packages/tui/test/product/lsp-adapter.test.ts`
- Modify: `sdks/vscode/src/product/lsp-adapter.test.ts`
- Modify: `packages/web/src/content/docs/zh-cn/lsp.mdx`

**Interfaces:**
- Consumes: shared `deriveProductLspStates()` and identical host `LspStatus[]` fixtures.
- Produces: locked TUI/VSCode Product projection parity for connected/error diagnostics and accurate Chinese default/download documentation.

- [ ] **Step 1: Add failing parity coverage for error semantics**

Use the same two-server fixture in both adapter suites:

```ts
[
  { id: "ts", name: "TypeScript", root: "/workspace", status: "connected" },
  { id: "rust", name: "Rust", root: "/workspace", status: "error" },
]
```

Assert deterministic order, `severity: "error"`, and `textKey: "error.lsp.connection_failed"`. If raw SDK status cannot carry diagnostic text, assert the canonical Product fallback message and document that raw protocol payload remains Core-owned.

- [ ] **Step 2: Run Product/TUI/VSCode focused tests**

Run:

```powershell
Push-Location packages/product; bun test test/lsp.test.ts; Pop-Location
Push-Location packages/tui; bun test test/product/lsp-adapter.test.ts; Pop-Location
Push-Location sdks/vscode; node --import tsx --test src/product/lsp-adapter.test.ts; Pop-Location
```

Expected: any missing shared fallback/parity assertion fails for the intended reason before production changes. If current Product behavior already satisfies a case, strengthen the fixture around an uncovered ordering/error edge rather than writing a test that starts green.

- [ ] **Step 3: Make only the minimal shared projection change required by RED**

If the RED test exposes a real Product gap, modify `packages/product/src/lsp.ts` and both adapters only as required. Do not add pending/unavailable states that the current Core status API cannot truthfully observe, and do not infer a different navigation or recovery policy in either Host.

- [ ] **Step 4: Correct the Chinese user documentation**

Replace “LSP 默认关闭” and “省略即禁用” with these semantics:

```text
HyperCode 默认启用 LSP 分析，但仅在打开或处理匹配文件时按需启动对应服务器。
设置 lsp: false 可显式关闭全部 LSP。
OPENCODE_DISABLE_LSP_DOWNLOAD=1 只禁止自动下载，不会关闭本地已可用的 LSP 服务器。
离线交付默认设置该环境变量。
```

- [ ] **Step 5: Run parity and type verification**

Run:

```powershell
Push-Location packages/product; bun test; bun typecheck; Pop-Location
Push-Location packages/tui; bun test test/product/lsp-adapter.test.ts; bun typecheck; Pop-Location
Push-Location sdks/vscode; node --import tsx --test src/product/lsp-adapter.test.ts; bun run check-types; Pop-Location
git diff --check
```

Expected: all focused suites and typechecks pass with no whitespace errors.

- [ ] **Step 6: Commit**

Stage only files actually changed by the RED/GREEN cycle:

```powershell
git add packages/product packages/tui/test/product/lsp-adapter.test.ts sdks/vscode/src/product/lsp-adapter.test.ts packages/web/src/content/docs/zh-cn/lsp.mdx
git commit -m "test(product): lock LSP behavior parity"
```

### Task 5: Full maintenance baseline verification

**Files:**
- Modify: `docs/阶段记录/2026-09-24-product-default-audit.md`

**Interfaces:**
- Consumes: Tasks 1-4 commits and the existing Product Alignment maintenance baseline.
- Produces: exact post-change test counts, known failures separated from new regressions, and fork-tax notes for future upstream sync.

- [ ] **Step 1: Run complete scoped verification**

Run each command from its package directory:

```powershell
Push-Location packages/product; bun test; bun typecheck; Pop-Location
Push-Location packages/opencode; bun test test/config/config.test.ts test/lsp test/script/offline-package.test.ts; bun typecheck; Pop-Location
Push-Location packages/tui; bun test test/product; bun typecheck; Pop-Location
Push-Location sdks/vscode; bun run check-types; bun run package; Pop-Location
```

Then run the repository's recorded VSCode related/full/parity commands from `docs/阶段记录/product-alignment-maintenance-baseline.md` (or its current successor) exactly as documented.

- [ ] **Step 2: Compare with the prior baseline**

Record exact pass/fail/error counts and distinguish known debt from new failures. Required outcome:

```text
NEW_REGRESSION=0
LSP_OMISSION_DEFAULT=ENABLED_LAZY
LSP_EXPLICIT_FALSE=PRESERVED
OFFLINE_LSP_DOWNLOAD=DISABLED
TUI_VSCODE_PRODUCT_PARITY=PRESERVED
```

Any new regression stops completion; do not relabel it as known debt.

- [ ] **Step 3: Record fork tax and verification evidence**

The audit record must identify the maintained downstream differences:

```text
packages/opencode/src/config/config.ts        HyperCode omission resolver
packages/core/src/v1/config/config.ts         HyperCode schema semantics
packages/opencode/script/offline-*.ts         profile-specific download policy
packages/web/src/content/docs/zh-cn/lsp.mdx   Chinese HyperCode behavior docs
```

Also state that `script/translate-app.ts` intentionally retains `lsp: false` as an explicit task-isolation policy.

- [ ] **Step 4: Final repository checks**

Run:

```powershell
git status --short
git diff --check HEAD
git log -5 --oneline
```

Expected: only the audit evidence update remains before the final commit; no unrelated or generated-client changes exist.

- [ ] **Step 5: Commit**

```powershell
git add docs/阶段记录/2026-09-24-product-default-audit.md
git commit -m "docs: record product default maintenance baseline"
```

## Self-Review

- Spec coverage: governance, five default classes, upstream gate, initial audit set, LSP default, explicit disable, online/offline download split, Product parity, Chinese docs, migration behavior and fork tax all map to Tasks 1-5.
- Placeholder scan: no `TBD`, generic “add tests”, or unspecified production implementation remains. Audit-only capabilities explicitly remain unchanged pending evidence.
- Type consistency: runtime `lsp` remains `ConfigLSPV1.Info`; Product continues to consume `LspStatus[]`; no Protocol or HttpApi type changes are introduced.
