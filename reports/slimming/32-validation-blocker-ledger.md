# Phase 4.8 Validation Blocker Ledger

> 本报告记录 Phase 4.8 当时的 blocker 状态；最终 Gate 由 `39-phase4-final-gate-review.md` 统一裁定。

## 当前结论

- Phase 4：`PASS_WITH_WARNINGS`。
- Phase 4.6：`PASS_WITH_WARNINGS`。
- Phase 4.7：`PASS_WITH_WARNINGS`。
- Phase 4.8：`PASS_WITH_WARNINGS`。
- Phase 5 Gate：`NOT_READY_FOR_PHASE_5`。

本阶段完成了 B1–B4 的归因和一次最小同步修复，但没有把任何环境红灯提升为 PASS，也没有进入 Deep Slimming。

## B1 — 在线 frozen install 网络阻塞

- Bun `1.3.14` 与项目 `packageManager` 一致。
- `bun install --frozen-lockfile --verbose` 能访问 registry，但在 `aws4fetch`、`@storybook/addon-docs` 等 manifest 请求上反复 timeout，最终停留在最后任务。
- `bun install --frozen-lockfile --offline` 成功完成 `2416` installs checked；VS Code 子工作区 offline install 也成功。
- 结论：`ENVIRONMENT_NETWORK_FAILURE`，不是依赖升级或 lockfile 解析失败。
- 处理：不改 registry 配置、不改 manifest、不改 `bun.lock`。

## B2 — A/B worktree Windows Bun hardlink blocker

- pure upstream 与 pre-sync HyperCode 的 frozen offline install 均在 Windows Bun linking 阶段失败。
- 代表性错误：`Hardlinking ... to a path that doesn't exist`，目标位于临时 `node_modules/.bun/.../husky/bin.js`。
- 两套 A/B worktree 都没有产生 tracked 文件改动，因此不能把它们的 runtime/test 结果当作 PASS 或 FAIL。
- 结论：`UPSTREAM_VALIDATION_ENV_INCOMPLETE`，A/B 对照继续冻结。

## B3 — Drizzle peer variant 残留

- `bun.lock` 和 workspace manifests 均声明 `drizzle-orm@1.0.0-rc.2`，未发现同步新增的 Drizzle 版本约束。
- cache 中同时存在两个完整 variant 和一个中断安装留下的残缺 variant；Core/OpenCode 的 junction 当前指向完整 `+acca00...` variant。
- 依赖重新链接后，`packages/core bun typecheck` 与 `packages/tui bun typecheck` 通过；因此原先的大量 Drizzle module error 是 layout cascade，不是业务源代码根因。
- 结论：`RECOVERED_ENVIRONMENT_RESIDUE`，保留诊断记录，不通过修改依赖迁就它。

## B4 — 代码/测试验证红灯

| Surface | 当前结果 | 归因 |
|---|---|---|
| Core typecheck | PASS | Drizzle cascade 已消失 |
| TUI typecheck | PASS | Drizzle cascade 已消失 |
| OpenCode typecheck | FAIL，仅 F-013 | pre-sync 历史 `NpmTest.noop` 返回类型债务 |
| VS Code check-types | PASS | F-014 已做最小 union 同步修复 |
| Core broad tests | `1089 pass / 7 skip / 4 fail` | Windows shell、legacy fixture、Windows `echo` 与 npm timeout |
| TUI broad tests | `195 pass / 1 skip / 3 fail` | Windows path separator、HyperCode branding 断言 |
| OpenCode broad tests | `3607 pass / 58 skip / 1 todo / 7 fail` | 6 个 Windows symlink `EPERM`、1 个 CLI help 空格快照差异 |
| OpenCode targeted suites | PASS | config/plugin/xAI/share/compaction/processor 修复后闭合 |
| A/B runtime | NOT_TESTED | B2 hardlink blocker |

F-013、Core/OpenCode/TUI broad failures 和 A/B 缺口均不能作为 Phase 5 删除依据。所有 broad red 均按 primary cluster 记录，不按堆栈或级联错误数量计数。

## 允许与禁止

允许：只读 upstream overlap、patch surface、冲突面和符号级分析；高置信、单文件、已有验证覆盖的同步修复。

禁止：依赖升级、manifest/lockfile 改动、修改测试以迎合 Gate、通过 `@ts-ignore`/`any`/放宽配置绕过类型检查，以及任何 Phase 5 删除或提取。
