# Phase 4 Feature Parity Audit

比较基线：`193de13a88d62a6409c6d385831180f1def527dc`（OpenCode 1.18.30）与 `0472ed06209bc24eb76508005b16737aa0d8638c`（HyperCode post-sync）。结论是审计建议，不是删除授权。

## Feature Inventory

| ID | Feature name | Purpose / HyperCode behavior | Current location | Upstream equivalent | Upstream evidence | Additional value / API-config-test evidence | Can fully replace? | Cost (surface/conflict/core/test/overlap) | Recommended disposition |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | HyperCode branding & compatibility | 公开 `hypercode` CLI、Desktop/Zen 文案，同时保留内部 `opencode` IDs/env | `packages/opencode/src/brand.ts`, CLI, root scripts | PARTIAL | Upstream CLI exists but uses `opencode` names; same-path branding conflicts in 20 CLI files | 产品名称、兼容入口和 rebrand workflow；help snapshots/API descriptions覆盖 | NO | 2/1/1/1/2=7 | `SIMPLIFY_CUSTOM` |
| F-02 | Enhanced VS Code extension | workspace sessions、panel、sidebar、todo、diff、subagents、server lifecycle | `sdks/vscode/src/**` | NO/PARTIAL | Upstream target contains lighter VS Code package; no equivalent panel surface | 236 post-sync paths，包含独立 commands/views/config/protocol tests | NO | 3/2/2/3/1=11 | `KEEP_CUSTOM` |
| F-03 | VS Code workspace/session panel | webview session UI 和 workspace-native workflow | `sdks/vscode/src/panel/**` | NO | target has no matching HyperCode panel implementation | panel provider、webview app、renderers、tests | NO | 3/2/2/3/1=11 | `KEEP_CUSTOM` |
| F-04 | VS Code sessions/todo/diff/subagents views | 侧栏公开产品视图和命令 | `sdks/vscode/src/sidebar/**`, manifest | PARTIAL | target metadata overlaps but view set differs | manifest commands/views与parity fixtures | NO | 3/2/2/3/1=11 | `KEEP_CUSTOM` |
| F-05 | VS Code runtime adapter | server launch、workspace、bridge、SDK adapter | `sdks/vscode/src/core`, `bridge` | PARTIAL | upstream SDK/client/protocol packages are newer, but adapter contract differs | 独立 server integration 与 test/parity 目录 | PARTIAL | 3/2/2/3/2=12 | `PARTIAL_UPSTREAM_REPLACEMENT` |
| F-06 | TUI Chinese localization & UX | 中文 UI、语言切换、提示、prompt 交互 | `packages/tui/src/i18n`, `src/component/prompt` | PARTIAL | upstream TUI structure/permission/location is reusable; no HyperCode locale layer | Phase 3 5-file conflicts及 locale files、TUI tests | NO | 2/2/1/2/2=9 | `KEEP_CUSTOM` |
| F-07 | License & machine identity | license command/runtime、machine ID fallback、VS Code validation | `packages/opencode/src/license`, `sdks/vscode/src/license` | UNKNOWN | target无同路径等价产品能力；现有 CLI/VS Code/tests有消费者 | license tests、CLI command、validator引用 | UNKNOWN | 2/1/2/3/0=8 | `NEEDS_REVIEW` |
| F-08 | Bundled config lifecycle | 首次同步内置配置，保护已有 config，支持 `hypercode.*` | `packages/opencode/src/config/config.ts`, `hypercode-bundled.ts` | PARTIAL | target `ConfigV2Compat`/config loader覆盖 schema/lifecycle部分 | config tests验证 fresh home、既有文件和 plugin install 条件 | NO | 2/3/2/3/2=12 | `PARTIAL_UPSTREAM_REPLACEMENT` |
| F-09 | Offline package delivery | Linux/Windows 离线包与资源准备 | `script/build-offline-*`, `packages/opencode/script/offline-*` | NO | target无对应 HyperCode delivery scripts | root scripts、CI/docs、offline package inputs | NO | 2/1/2/3/1=9 | `KEEP_CUSTOM` |
| F-10 | Provider/model compatibility | provider registry、模型元数据、fallback、兼容提示 | `packages/opencode/src/provider`, plugins | PARTIAL | target provider registry/API持续演进；Phase 3 provider conflicts | provider tests、models fixture、plugin APIs | PARTIAL | 2/3/2/3/3=13 | `PARTIAL_UPSTREAM_REPLACEMENT` |
| F-11 | Session execution/runtime | message lifecycle、V2 dual-write、retry、stream边界 | `packages/opencode/src/session/**` | PARTIAL | target已有 SessionV2/projector/execution local；语义未完全等价 | processor/session/retry tests，Phase 3高风险冲突 | UNKNOWN | 3/3/3/3/3=15 | `HIGH_RISK_KEEP` |
| F-12 | Video replica workflow | 豆包视频复刻、图像生成、checkpoint/fallback workflow | project skills、workflow/tool 新增文件 | UNKNOWN | 未找到 target 等价入口；依赖动态 provider/tool discovery | 用户实验脚本、skills与artifact package | UNKNOWN | 3/0/2/3/0=8 | `NEEDS_REVIEW` |
| F-13 | Repo agents/skills/commands | `.opencode` filesystem-discovered workflow | `.opencode/agent`, `skills`, `command` | PARTIAL | discovery mechanism upstream存在；内容和规则为 HyperCode | filesystem discovery、命令/skill文档与测试 | NO | 2/1/1/2/1=7 | `KEEP_CUSTOM` |
| F-14 | Sync/rebrand workflow | 锁定 upstream、重品牌 dry-run/write、审计报告 | `scripts/`, `docs/`, `reports/` | NO | target无 HyperCode同步 SOP | sync/rebrand scripts与Phase报告 | NO | 1/0/1/1/0=3 | `KEEP_CUSTOM` |
| F-15 | Compatibility env aliases | `HYPERCODE_*`优先、`OPENCODE_*`回退 | `packages/core/src/flag/flag.ts`, runtime flags | YES (partial) | upstream flags only read `OPENCODE_*`; two local implementations | API compatibility、runtime config tests待补 | PARTIAL | 2/2/1/2/2=9 | `SIMPLIFY_CUSTOM` |

## Disposition Counts

| Disposition | Count |
|---|---:|
| `KEEP_CUSTOM` | 7 |
| `UPSTREAM_REPLACEMENT` | 0 |
| `PARTIAL_UPSTREAM_REPLACEMENT` | 3 |
| `SIMPLIFY_CUSTOM` | 2 |
| `EXTRACT_TO_PLUGIN` | 0 |
| `EXTRACT_TO_PACKAGE` | 0 |
| `EXTRACT_TO_AGENT` | 0 |
| `EXTRACT_TO_SKILL` | 0 |
| `MERGE_DUPLICATES` | 0 |
| `REMOVE_LEGACY_COMPAT` | 0 |
| `NEEDS_REVIEW` | 2 |
| `HIGH_RISK_KEEP` | 1 |

没有 feature 满足“新版完整实现、无额外行为、切换后无产品损失”的严格 `UPSTREAM_REPLACEMENT` 条件。`EXTRACT_*`、`MERGE_DUPLICATES` 和 `REMOVE_LEGACY_COMPAT` 暂无足够证据进入实际迁移；相关方向进入候选台账。
