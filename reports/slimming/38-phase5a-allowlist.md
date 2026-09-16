# Phase 5A Allowlist

Phase 5A 只允许低风险、可回滚、按区域验证的候选。任何一项都不代表本文件创建时已经执行修改。

## Allowed

### C-009 — CLI branding resource

- Area：Brand/env compatibility
- Why allowed：静态重复置信度 High；范围集中；App build 和 CLI/help tests 可检测行为变化。
- Static confidence：High
- Validation：CLI help snapshot、CLI smoke、`packages/opencode bun typecheck`（允许已知 F-013）以及 baseline signature 对比。
- Expected Fork reduction：集中 branding resource，减少约 20 个 CLI path 的 hardcoded product strings。
- Guardrails：第一轮只做资源集中和引用替换；保留 `opencode` 内部 ID 与 `hypercode` 用户可见文案边界；不得更新 snapshot 掩盖差异。
- Rollback：单独提交，失败即回退该提交并恢复 baseline。

### C-001 — Env flag aliases

- Area：Brand/env compatibility
- Why allowed：两处 alias parser 重复已静态确认，Core/OpenCode typecheck 可运行。
- Static confidence：Medium
- Validation：新增 precedence/consumer characterization 后运行 Core/OpenCode typecheck 与相关 flag tests。
- Expected Fork reduction：合并两处 alias 解析分支，降低双路径漂移。
- Guardrails：保持 `HYPERCODE_*` 与 `OPENCODE_*` 优先级和兼容语义；不删除旧 alias。
- Rollback：保留原 parser 路径，按测试结果单提交回退。

### C-002 — Bundled config bootstrap

- Area：Config compatibility
- Why allowed：targeted config 118 pass，Core typecheck PASS，属于局部兼容层缩小而非 schema 删除。
- Static confidence：Medium
- Validation：config suite、fresh-home smoke、app build、OpenCode typecheck baseline。
- Expected Fork reduction：缩小 bundled config bootstrap wrapper 和重复保护分支。
- Guardrails：不删除 schema、legacy field 或 filename；第一轮只做 extraction/deduplication；保留 characterization tests。
- Rollback：保留旧入口并以 feature-equivalent commit 回退。

### C-007 / C-008 — OAuth callback utility/pages

- Area：OAuth callback utility
- Why allowed：xAI targeted 24 pass；共享 callback page 与 provider-specific 页面边界已静态定位。
- Static confidence：Medium/High（C-007），Medium（C-008）
- Validation：OAuth mock、PKCE/state/error tests、provider auth tests、typecheck；不要求真实网络 callback。
- Expected Fork reduction：减少重复 callback HTML/helper，保留 provider lifecycle。
- Guardrails：不得改变 token storage、state/PKCE 校验、端口绑定或错误文案契约；不改 provider loading。
- Rollback：按 provider 页面/utility 分拆提交，单项回退。

### C-012 — Offline delivery boundary

- Area：Offline package
- Why allowed：入口、脚本和 package boundary 静态清晰，与 Session/TUI/VS Code protocol 无直接耦合。
- Static confidence：Medium
- Validation：offline script/package inspection、clean-environment artifact smoke；完成 smoke 前只允许边界整理。
- Expected Fork reduction：缩小 offline workflow 与 core build 的交叉维护面。
- Guardrails：不改依赖和 build script 的安装行为；artifact smoke 未通过前不得删除入口。
- Rollback：保持原脚本入口，边界调整独立提交可回退。

### C-005 — Retry copy/resource

- Area：Branding/localization
- Why allowed：主要是文案资源集中，runtime criticality 低。
- Static confidence：Medium
- Validation：retry characterization、locale/snapshot tests、OpenCode typecheck。
- Expected Fork reduction：减少 retry 文案散落 hardcode。
- Guardrails：不改变 retry policy、错误分类或收费提示语义；中文文案必须保留。
- Rollback：资源提交单独回退。

## Frozen

| Area / candidate | Reason | Unfreeze condition |
|---|---|---|
| Session / C-004 | 高风险 state/message/tool/event ordering | 独立 characterization + runtime integration baseline |
| VS Code / C-010/C-016 | 31k LOC 级产品面，protocol/runtime 风险高 | 独立 extension/package/protocol matrix |
| TUI / C-011 | 产品行为敏感且有 Windows baseline red | 专项 TUI behavior matrix；不与 Session 同批 |
| Provider lifecycle / C-006 | provider fallback/registration 语义未闭合 | provider matrix 与 fallback smoke |
| Plugin architecture | loader/lifecycle 影响面大 | plugin contract matrix |
| Drizzle/dependency topology | 不属于 slimming 目标，环境残留仍需隔离 | 独立 dependency baseline |
| Global config schema / C-003 | legacy consumer 与版本兼容未证明 | consumer audit + migration plan |
| License / C-013 | 产品策略和 runtime 依赖未决定 | 产品决策 + license tests |
| Video workflow / C-014 | 动态入口和外部流程未闭合 | call graph + runtime smoke |
| Repo agents/skills / C-015 | 产品差异而非技术冗余 | 明确产品替代方案 |
