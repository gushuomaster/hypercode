# Proposal

## Why

HyperCode 停在 OpenCode 1.18.30（同步基线 `193de13a8`）。upstream 1.x 维护线已发布到 v1.19.6（`f4e363c829`，2026-11-17），共 209 个提交，带来缺陷修复（如历史图片重复发送上限、`debug config` 凭据脱敏、按推理选项生成 variants）。`prepare-upstream-sync` 已完成同步前准备：正式 fork tax 基线 `221 / 149 / 62 / 1538`、已知失败签名、对照验证方法和影响评估都已就绪，`dev` 与 `origin/dev` 一致。

v1.19.x 同时引入了与 HyperCode 品牌化冲突的行为：TUI 新增 `/update` 对话框和更新提示，在 1.x 已是最新时推销并安装 **OpenCode 2.0**；v1.19.6 的桌面版也加入同样的推销。HyperCode 没有自己的更新渠道，如果直接合入，用户会看到 OpenCode 品牌，甚至被引导把 HyperCode 换成 upstream OpenCode。

## What Changes

- 在隔离 worktree 中把 v1.19.6 合入 HyperCode，解决 16 个真实冲突：保留 upstream 功能修复，保留 HyperCode 品牌、本地化、Product 命令目录与授权门禁。
- 产品默认值审查结论 `PRESERVE_HYPERCODE_DEFAULT`：交付版不检查、不提示、不安装 upstream 更新；`/update` 不对用户开放；`hypercode upgrade` 改为中文提示"没有在线更新渠道"，不再从 upstream 渠道安装。
- 版本号升到 1.19.6，交付文档与升级说明随之更新。
- 完成工程验证、品牌检查与跨宿主契约审查，重测 fork tax，打出 EXE、VSIX、Ubuntu 离线包交人工验收。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `product-default-policy`：新增"交付版不使用 upstream 更新渠道"要求。

## Impact

- 合并面：`packages/opencode`、`packages/tui`、`packages/core`、`sdks/vscode`、`packages/sdk` 等 upstream 改动；`packages/desktop`、`packages/console`、`packages/web`、`packages/stats` 不在交付面，按 upstream 原样接收。
- HyperCode 适配点：`packages/opencode/src/cli/upgrade.ts`、`cli/cmd/upgrade.ts`、`packages/product` 命令目录、TUI 命令适配器测试、本地化审计基线。
- 文档：`reports/slimming/post-slimming-baseline.md`、升级说明、安装部署说明、阶段记录。
- 正式主线 `dev` 在人工验收通过前不变。
