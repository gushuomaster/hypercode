# Proposal

## Why

CLI/TUI 本地化（`openspec/changes/archive/2026-09-18-cli-localization/`）的核心已在 `ee8d4a67c` 落地，但收尾项未完成：

- 计划中的 `packages/opencode/test/cli/localization-audit.test.ts` 从未创建。现有 `packages/tui/test/i18n/hardcoded-copy.test.ts` 只扫描 TUI，`packages/opencode/src/cli` 与仓库自带命令元数据（`.opencode/command`）没有防止英文文案回退的审计。upstream 同步最容易在 CLI 侧带回英文。
- 用户文档 `docs/用户指南/1.18.30升级说明.md` 只写了"跟随语言环境 / 帮助中文化 / 标识保持原样"，缺少语言优先级（`tui.json` > `/language` 保存的选择 > 系统语言）、`/language` 即时切换、外部来源标签的说明。
- 本地化行为没有对应的主 spec，`AGENTS.md` 要求的"关键用户可见流程需要中文 regression 覆盖"缺少可追溯的规范依据。

## What Changes

- 新增 CLI 侧本地化审计测试，扫描 `packages/opencode/src/cli` 与仓库自带命令元数据，白名单只放行技术标识。
- 补齐用户文档中的语言优先级、`/language` 切换与外部来源标签说明。
- 新增 `cli-localization` 主 spec，记录已实现的语言选择、翻译/保留规则与防回归要求。

## Capabilities

### New Capabilities

- `cli-localization`：HyperCode CLI/TUI 的语言选择、中文/英文展示规则与本地化防回归要求。

### Modified Capabilities

（无）

## Impact

- 新测试：`packages/opencode/test/cli/localization-audit.test.ts`
- 可能需要修正审计发现的 `packages/opencode/src/cli/**` 硬编码文案及 `.opencode/command/*.md` 元数据（注意 `.opencode/` 为 upstream 目录，修改需评估 fork tax）
- `docs/用户指南/1.18.30升级说明.md`、`docs/用户指南/使用说明书.md`
