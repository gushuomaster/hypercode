# Phase 4.7 Static Phase 5 Ranking

## Scope and Method

比较基线为 OpenCode `193de13a88d62a6409c6d385831180f1def527dc`，目标为 HyperCode post-sync `0472ed06209bc24eb76508005b16737aa0d8638c`。本排名只使用 Git diff、静态 imports/exports、配置路径、调用者和现有报告；不把静态结论当作删除授权。

Fork Tax 使用六项各 0–3 分：upstream files touched、private API dependency、conflict history、duplication with upstream、validation difficulty、runtime criticality。总分 0–18，仅表示维护成本，不表示产品价值或删除优先级。

## Ranking

| Rank | Candidate / area | Tax | Value | Static disposition | Phase 5 status |
|---:|---|---:|---|---|---|
| 1 | Session execution/runtime（C-004） | 18 `VERY_HIGH` | High | `CORE_SEMANTIC_PATCH` / `HIGH_RISK_KEEP` | `FROZEN` |
| 2 | Config bootstrap + filename compatibility（C-002/C-003） | 15 `VERY_HIGH` | High | `CORE_COMPAT_PATCH` + partial upstream overlap | `READY_WITH_GUARDRAILS` |
| 3 | Provider registry/model metadata（C-006） | 14 `VERY_HIGH` | High | `CORE_EXTENSION_PATCH` / partial duplicate | `FROZEN` |
| 4 | xAI OAuth loopback/device flow（C-007） | 14 `VERY_HIGH` | High | `PLUGIN_EXTRACTION_HIGH_VALUE` / `STATIC_PARTIAL` | `READY_WITH_GUARDRAILS` |
| 5 | VS Code runtime adapter and protocol wrappers（C-010/C-016） | 13 `HIGH` | High | product surface + upstream partial overlap | `FROZEN` |
| 6 | TUI localization/UX（C-011） | 11 `HIGH` | High | product/localization patch | `FROZEN` |
| 7 | Env flag aliases（C-001） | 10 `HIGH` | Medium/High | `DUPLICATE_IMPLEMENTATION` / package candidate | `READY_WITH_GUARDRAILS` |
| 8 | Offline delivery scripts（C-012） | 9 `HIGH` | High in restricted networks | `KEEP_CUSTOM` / package boundary candidate | `READY_WITH_GUARDRAILS` |
| 9 | License and machine identity（C-013） | 9 `HIGH` | Unknown | `UNKNOWN_RUNTIME_DEPENDENCY` | `FROZEN` |
| 10 | CLI branding resource（C-009） | 8 `MEDIUM` | Medium | `SIMPLIFY_CUSTOM` / thin patches | `PHASE5A_READY` |
| 11 | Shared OAuth callback pages（C-008） | 8 `MEDIUM` | Medium | `UPSTREAM_REPLACEMENT_CANDIDATE` | `READY_WITH_GUARDRAILS` |
| 12 | Retry copy/resource（C-005） | 6 `MEDIUM` | Low/Medium | `SIMPLIFY_PATCH_CANDIDATE` | `READY_WITH_GUARDRAILS` |
| 13 | Repo agents/skills/commands（C-015） | 5 `MEDIUM` | High for workflow | `PRODUCT_DIFFERENTIATION` | `FROZEN` |
| 14 | Video replica workflow（C-014） | 12 `HIGH` | Unknown/experimental | `UNKNOWN_RUNTIME_DEPENDENCY` | `FROZEN` |

## P0

`P0 = 0`。没有同时满足高静态证据、低 runtime 风险、低产品价值和已有可重复验证的候选。当前 validation gate 不允许把任何删除动作升级为 P0。

## P1

- C-001：集中 alias parsing 的静态设计；只允许先补 precedence/consumer map，不得改变行为。
- C-009：建立 Brand/resource 使用清单；只允许资源盘点和静态替换计划。
- C-007：确认 OAuth 依赖的 public/private 边界；不得先移动实现。
- C-005/C-008：小范围文案/页面重叠分析；保留 auth/retry 行为。

## Final Status Rule

本排名的 `Phase 5 status` 仅使用 `PHASE5A_READY`、`READY_WITH_GUARDRAILS`、`FROZEN`。A/B runtime 缺口通过区域冻结和候选 guardrail 处理，不再使用 `BLOCKED_BY_RUNTIME` 作为全局状态。

## Joint Value / Tax

| Joint class | Candidates | Static conclusion |
|---|---|---|
| High value / low tax | TUI locale resources、repo workflow content | KEEP；产品差异不应当被当成技术冗余 |
| High value / high tax | Session、VS Code、config、provider、offline | EXTRACT/SIMPLIFY 方向可研究，但目前冻结 |
| Low/medium value / low tax | CLI branding、retry copy | 适合未来资源集中，需 guardrails |
| Low value / high tax | 暂无已证实项 | 没有足够证据进入删除候选 |

## Gate

本排名将候选收敛为 Phase 5A 白名单与冻结区，不授权本阶段执行修改。
