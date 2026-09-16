# Area Validation Gates

| 区域 | Gate | 证据 | 解冻/推进条件 |
|---|---|---|---|
| Branding / env | `READY`（C-009） / `READY_WITH_GUARDRAILS`（C-001） | App build、CLI/help tests 可检测；alias parser 重复已静态确认 | C-009 先做资源集中；C-001 先补 precedence characterization |
| Localization | `READY_WITH_GUARDRAILS`（仅资源层） | 中文资源与 branding 边界已定位 | 不改行为，不覆盖 HyperCode 文案 |
| Offline package | `READY_WITH_GUARDRAILS`（C-012） | package/script/filesystem 边界清晰；与 Session/TUI/VS Code protocol 无直接耦合 | clean-environment artifact smoke 通过前不删除入口 |
| Config compatibility | `READY_WITH_GUARDRAILS`（C-002） | Core typecheck PASS；config targeted 118 pass | fresh-home smoke；不删 schema/legacy field |
| OAuth callback utility | `READY_WITH_GUARDRAILS`（C-007/C-008） | xAI targeted 24 pass；callback helper/page 边界已定位 | PKCE/state/error characterization；不改 provider lifecycle |
| Retry copy/resource | `READY_WITH_GUARDRAILS`（C-005） | 低 runtime criticality；资源集中可由 snapshot/locale tests 检测 | 不改 retry policy 或错误分类 |
| Provider lifecycle | `FROZEN` | provider registry/fallback 仍是高风险核心 | provider matrix + fallback smoke |
| Session | `FROZEN` | processor/compaction targeted green，但 state/event ordering 高风险 | 独立 runtime integration baseline |
| TUI architecture | `FROZEN` | typecheck PASS，但仍有 3 个 Windows/branding baseline red | 专项 TUI behavior matrix |
| VS Code runtime/protocol | `FROZEN` | check-types PASS，但产品面约 31k LOC、协议风险高 | 独立 extension/package/protocol matrix |
| Plugin architecture | `FROZEN` | loader/lifecycle 影响面大 | plugin contract matrix |
| Drizzle/dependency topology | `FROZEN` | variant 残留已归因，但不属于 slimming 目标 | 独立 dependency baseline |
| Global config schema / filename removal | `FROZEN` | legacy consumer 与版本兼容未证明 | consumer audit + migration plan |
| License / machine identity | `FROZEN` | 产品策略和 runtime 依赖未决定 | 产品决策 + license tests |
| Video workflow | `FROZEN` | 动态入口和外部流程未闭合 | call graph + runtime smoke |
| Repo agents/skills/commands | `FROZEN` | 产品差异而非技术冗余 | 明确产品替代方案 |

## Rule

`READY` 仅允许低风险、可独立验证的白名单项；`READY_WITH_GUARDRAILS` 必须先补 characterization 并保持回滚点；`FROZEN` 区域不得在 Phase 5A 修改。
