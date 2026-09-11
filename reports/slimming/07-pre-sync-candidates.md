# Phase 2 Pre-Sync Candidate Ledger

审计时间：2026-09-11（Asia/Shanghai）  
工作区：`D:/project/hypercode`  
隔离清理工作区：`.worktrees/pre-sync-slimming`  
基线：`bf05e8a1224d6560f7a441f70d09e0c77e50e931`  
目标：`refs/audit/opencode-dev` = `193de13a88d62a6409c6d385831180f1def527dc`

## 决策规则

本台账只允许以下决策进入实际修改：`SAFE_DELETE`、`SAFE_DEP_REMOVE`、`SAFE_CONFIG_REMOVE`、`SAFE_GENERATED_CLEANUP`、`SAFE_EXPERIMENTAL_CLEANUP`、`SAFE_OBSOLETE_SCRIPT_REMOVE`、`SAFE_AGENT_SKILL_CLEANUP`。任何运行时、动态发现、交付流程、公共入口或产品语义不确定项均不修改。

## 候选总览

| ID | Path | Category | Decision | Expected files changed |
| --- | --- | --- | --- | ---: |
| ARC-001 | `packages/opencode/src.rar` | 历史源码归档 | `SAFE_DELETE` | 1 |
| ARC-002 | `packages/opencode/script/license.rar` | 历史工具归档 | `SAFE_DELETE` | 1 |
| GEN-001 | `sdks/vscode/.vscode-test/` | 本地 VS Code 测试下载/缓存 | `KEEP`（用户已有未跟踪内容） | 0 |
| GEN-002 | `release-artifacts/` | 离线交付输出目录 | `DEFER_UNTIL_SYNC` | 0 |
| GEN-003 | `packages/opencode/dist/`、`sdks/vscode/dist/` | 构建输出目录 | `DEFER_UNTIL_SYNC` | 0 |
| TMP-001 | `tmp/` | 临时 source/vendor/compare 内容 | `NEEDS_REVIEW` | 0 |
| SCR-001 | `packages/opencode/script/httpapi-exercise.ts` | HTTP API 验证入口 | `KEEP` | 0 |
| SCR-002 | `packages/opencode/script/bench-test-suite.ts` | 测试基准入口 | `KEEP` | 0 |
| SCR-003 | `packages/opencode/script/profile-test-files.ts` | 测试分析入口 | `KEEP` | 0 |
| SCR-004 | `packages/opencode/script/trace-imports.ts` | 开发诊断脚本 | `NEEDS_REVIEW` | 0 |
| SCR-005 | `packages/opencode/script/run-real-doubao.ts` | 用户已有实验脚本 | `KEEP`（用户已有未跟踪内容） | 0 |
| AGENT-001 | `.opencode/agent/duplicate-pr.md`、`.opencode/agent/triage.md` | Agent 定义 | `KEEP` | 0 |
| SKILL-001 | `.opencode/skills/effect/SKILL.md` | Skill 定义 | `KEEP` | 0 |
| CMD-001 | `.opencode/command/*.md` | Command 定义 | `KEEP` | 0 |
| VS-001 | `sdks/vscode/src/test/parity/*` | VS Code parity fixtures/golden | `KEEP` | 0 |
| LIC-001 | `packages/opencode/src/license/*`、`sdks/vscode/src/license/*` | License 产品能力 | `DEFER_UNTIL_SYNC` | 0 |
| DEP-001 | 根及 workspace dependencies | 依赖拓扑 | `DEFER_UNTIL_SYNC` | 0 |
| DOC-001 | `docs/`、`reports/`、`specs/` | 审计/规范/历史记录 | `KEEP` | 0 |

## SAFE_DELETE

### ARC-001 — `packages/opencode/src.rar`

- **Category:** `SAFE_DELETE`
- **Reason:** 这是一次性历史源码快照，不是运行时输入、构建输入或发布输入。
- **Evidence:**
  1. 文件在当前 HyperCode delta 中是新增路径，merge base 和目标 OpenCode 均不存在该路径。
  2. `tar -tf` 可读取归档；归档包含 404 个 `src/**` 文件。
  3. 将归档解包到临时目录后，404 个路径全部存在于现行 `packages/opencode/src/`；400 个字节完全一致，4 个是旧版本副本（`config/config.ts`、`config/hypercode-bundled.ts`、`license/license.ts`、`plugin/index.ts`）。
  4. `git grep`、package scripts、CI、构建脚本、文档和配置均没有 `src.rar` 字符串引用。
  5. 归档不会被 OpenCode 的 `.opencode`、plugin、agent、skill 或 filesystem discovery 机制发现。
  6. 目标上游不存在同路径，也不存在引用。
- **References:** 无静态、动态、字符串、注册表、配置、测试、脚本、CI 或文档引用。
- **Runtime risk:** 无；删除不改变任何可执行路径。
- **Upstream overlap:** 无同路径；目标上游没有该归档。
- **Conflict-map status:** 不在 38 个 trial-merge conflict 中；属于 HyperCode-only artifact。
- **Expected files changed:** 删除 1 个文件。
- **Validation method:** 删除后确认 `git grep` 无引用；执行受影响 package 的 typecheck；重新统计 delta 与 trial merge。
- **Decision:** `SAFE_DELETE`

### ARC-002 — `packages/opencode/script/license.rar`

- **Category:** `SAFE_DELETE`
- **Reason:** 这是 license 工具目录的历史归档，现行目录已包含完整工具链。
- **Evidence:**
  1. 文件在当前 HyperCode delta 中是新增路径，merge base 和目标 OpenCode 均不存在该路径。
  2. 归档只包含 `license/licenseGenerator.cjs` 和 `license/README.md` 两个文件。
  3. 解包后两个文件均有现行对应项；现行文件内容已演进，归档不是唯一实现。
  4. 现行 `packages/opencode/script/license/` 还包含 `license_generator.py`、`build.ps1`、测试和 requirements；README 明确 Node 工具仍是兼容入口，不能删除目录或实现文件。
  5. `git grep`、package scripts、CI、构建脚本、文档和配置均没有 `license.rar` 字符串引用。
  6. 归档不会被 license runtime、CLI、VS Code extension 或动态模块加载发现。
- **References:** 无对 `license.rar` 的引用；现行 license 文件本身仍被 CLI、VS Code、测试和文档引用，但删除归档不影响它们。
- **Runtime risk:** 无；只删除备份容器，不删除 license 实现。
- **Upstream overlap:** 无同路径；目标上游没有该归档。
- **Conflict-map status:** 不在 38 个 trial-merge conflict 中；属于 HyperCode-only artifact。
- **Expected files changed:** 删除 1 个文件。
- **Validation method:** 删除后确认 `git grep` 无引用；运行 `packages/opencode` license tests 与 typecheck；重新统计 delta 与 trial merge。
- **Decision:** `SAFE_DELETE`

## KEEP / 用户已有内容

### GEN-001 — `sdks/vscode/.vscode-test/`

这是 VS Code integration test 下载的运行缓存，当前为用户在审计前已有的未跟踪目录。虽然目录具有 generated/cache 特征，但本阶段不得删除或覆盖用户已有内容；Phase 2 只记录，不纳入变更。

### SCR-005 — `packages/opencode/script/run-real-doubao.ts`

这是用户已有的未跟踪实验脚本。即使静态调用较少，也不能在本阶段推断其无价值或覆盖它。

## KEEP / 已确认有消费者

### SCR-001 — `packages/opencode/script/httpapi-exercise.ts`

`packages/opencode/package.json` 的 `test:httpapi` 脚本直接调用该文件，且目标测试目录包含真实 HTTP API exercise harness；不能删除。

### SCR-002 — `packages/opencode/script/bench-test-suite.ts`

package script `bench:test` 直接调用；属于受支持的测试性能入口。

### SCR-003 — `packages/opencode/script/profile-test-files.ts`

package script `profile:test` 直接调用；属于测试分析入口。

### AGENT-001 / SKILL-001 / CMD-001

`.opencode` 下的 Agent、Skill、Command 由 OpenCode 的 filesystem discovery 机制动态发现。静态 import 为零不能证明 orphan；现有代码明确扫描 `.opencode/agent(s)`、`.opencode/skill(s)`、`.opencode/command(s)`，因此保持。

### VS-001 — VS Code parity fixtures/golden

`check-upstream-parity.ts`、`generate-upstream-golden.ts`、parity tests 直接读取这些 fixture/golden 文件；不是过期生成物。

### DOC-001 — 文档、规范、审计报告

这些内容包含上游同步依据、用户可见规则和 Phase 0/1 取证。不能以“已完成”作为删除依据。

## NEEDS_REVIEW

### TMP-001 — `tmp/`

目录名显示临时用途，但需要确认所有者、是否被离线构建/比较工具或外部运维流程使用。当前无充分证据进行删除，且目录受 `.gitignore` 保护；不修改。

### SCR-004 — `packages/opencode/script/trace-imports.ts`

当前未发现 package script 或静态调用，但它是可从命令行直接调用的开发诊断工具，且包含硬编码开发机路径。没有证据证明它已废弃或由其他工具替代；标记 `NEEDS_REVIEW`，不修改。

## DEFER_UNTIL_SYNC

### GEN-002 / GEN-003 — release 与 dist 输出

这些目录出现在离线构建、发布 workflow、操作手册和 VS Code packaging 文档中。即使通常为生成物，也必须在确认交付和复现流程后再处理；当前不修改。

### LIC-001 — License 产品能力

License 代码存在 CLI、VS Code、测试和文档调用；项目文档对“是否保留授权入口”存在边界说明，但没有产品决策证据。归档可以删除，runtime/CLI/VS Code 实现不能在本阶段处理。

### DEP-001 — dependencies

根 package 与 workspace package 依赖拓扑处于 38 个冲突的高风险区域；本轮没有满足“全局无消费者 + 删除后验证”的依赖候选。保持不变。

## 批次建议

仅建立一个归档清理批次：`BATCH-ARC-01`，包含 ARC-001 和 ARC-002，共删除 2 个文件，修改文件数为 0。不得把脚本、Agent/Skill、license runtime、依赖或生成目录混入该批次。

