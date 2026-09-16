# Phase 4.7 Static Duplication and Dead-Code Audit

## Counts

| Classification | Count | Confidence | Meaning |
|---|---:|---|---|
| `EXACT_DUPLICATE` | 0 | High | 未找到可证明完全相同且可互换的实现 |
| `SEMANTIC_DUPLICATE` | 2 | Medium/High | env alias parsing；Brand/resource 与散落品牌 hardcode |
| `PARTIAL_DUPLICATE` | 4 | Medium | config filename arrays、OAuth callback HTML、provider metadata mapping、panel/sidebar message plumbing |
| `SIMILAR_BUT_DISTINCT` | 6 | Medium | Linux/Windows offline、CLI/VS Code license、TUI/App locale、xAI/device OAuth 等 |
| `STATIC_DEAD_HIGH_CONFIDENCE` | 0 | High | 没有排除动态注册、脚本直调和外部入口的安全候选 |
| `STATIC_DEAD_MEDIUM_CONFIDENCE` | 2 groups | Medium | `trace-imports.ts` direct-invocation candidate；Brand 中未被仓内引用的 URL/metadata fields |
| `DYNAMIC_REFERENCE_POSSIBLE` | 5 groups | High | plugin discovery、`.opencode` agents/skills/commands、offline entrypoints、video workflows、license paths |
| `STATIC_OBSOLETE_COMPAT` | 0 | High | 当前仍有 consumer/test/version compatibility evidence |

## Duplicate Findings

### D-001 — Env alias parsing

`packages/core/src/flag/flag.ts:env` 与 `packages/opencode/src/effect/runtime-flags.ts:names` 都把 `OPENCODE_*` 映射到 `HYPERCODE_*` 并保留 fallback。输入是 env key，输出是优先级/解析后的配置值，调用者分别是 Core static flags 与 Effect runtime config。分类为 `SEMANTIC_DUPLICATE`，但不能直接合并：初始化时机、Config provider 和 public `Flag` shape 不同。

### D-002 — Branding resource vs hardcodes

`packages/opencode/src/brand.ts:Brand` 已被 MCP、IDE、installation、server mdns 和部分 CLI 使用，但仍有大量 CLI/ACP/API description/prompt 字符串直接写入 `HyperCode`。分类为 `SEMANTIC_DUPLICATE` 的资源治理问题，不是证明可以删除字符串或 Brand 字段。

### D-003 — Config filename candidate arrays

`packages/core/src/config.ts`、`packages/opencode/src/config/config.ts`、TUI config paths 各自维护 config filename/directory 兼容路径。分类为 `PARTIAL_DUPLICATE`；consumer 和优先级不同，需静态统一表后再 runtime 验证。

### D-004 — OAuth callback page behavior

`core/oauth/page.ts`、xAI loopback HTML、Codex/DigitalOcean callback pages 共享 escape/branding/CORS 概念，但 callback state、token exchange 和 provider lifecycle 不同。分类为 `PARTIAL_DUPLICATE`，适合未来 package/plugin boundary 分析。

### D-005 — Provider metadata mapping

upstream `fromModelsDevProvider` 与 HyperCode `HyperCode Zen` display-name override 只部分重叠；provider loader/fallback 仍有 custom dependency。分类为 `PARTIAL_DUPLICATE`，不得按函数名替换。

## Static Dead Candidates

- `packages/opencode/script/trace-imports.ts`：仓内无静态 caller，但脚本可被开发者直接调用，标 `STATIC_DEAD_MEDIUM_CONFIDENCE`，不删除。
- `Brand.docsURL`、`issueURL`、`providerURL`、`goURL`、`releaseRepo` 等字段当前仓内引用数为 0；可能是外部 metadata contract，标 `STATIC_DEAD_MEDIUM_CONFIDENCE`，不删除。
- Plugin discovery、filesystem `.opencode` content、offline build entrypoints、license paths、video workflow 仍有动态/脚本引用可能，统一标 `DYNAMIC_REFERENCE_POSSIBLE`。

## Legacy Compatibility Audit

| Surface | Evidence | Classification |
|---|---|---|
| `hypercode.json/jsonc` | Config parser、Core config、opencode config tests和 bundled flow均有 consumer | `ACTIVE_COMPAT` |
| `config.json` fallback | Core config names、fresh-home tests、错误文案均引用 | `ACTIVE_COMPAT` |
| `OPENCODE_*` env names | Core flags、runtime flags、TUI/config consumers大量引用 | `ACTIVE_COMPAT` |
| `Brand.command` / internal opencode IDs | installation、MCP、IDE、provider、server consumers | `ACTIVE_COMPAT` |
| `.hypercode` config directory check | config lifecycle显式分支 | `ACTIVE_COMPAT` |
| `customize-opencode` skill name/schema URL | builtin skill registration和配置文档引用 | `RUNTIME_REQUIRED` |
| old filename/legacy theme metadata fields | 仅部分静态引用或外部可见 | `POSSIBLE_OBSOLETE_COMPAT` |

## Conclusion

Phase 4.7 没有发现可直接删除的 high-confidence static dead code，也没有发现 exact duplicate。最有价值的是把两个 semantic duplicate 和四个 partial duplicate 变成未来 test-first 的边界候选。
