# 落实 license 门禁（resolve-license-boundary）

## Goal

按 OpenSpec change `resolve-license-boundary` 落实 2026-11-12 的 D1 决策：交付版强制授权，授权门禁是受保护的 hypercode 能力。

## Requirements

需求以 `openspec/changes/resolve-license-boundary/specs/license-gate/spec.md` 为准，本文件不重复：

- 强制授权，跳过范围不变
- Ed25519 签名的 v2 license，产品只含公钥；旧格式直接失效并给出专门提示
- Windows 机器码用 MachineGuid，Linux 用 `/etc/machine-id`，输出派生指纹
- 只支持 Windows/Linux，其他平台提示“该平台不在交付范围”
- CLI 是唯一校验实现，VSCode 调用 `license status --json`
- 签发工具保留在内部仓库但不进入交付物，生产私钥不进 git
- 门禁调用有回归测试保护

## Acceptance Criteria

- [x] `openspec/changes/resolve-license-boundary/tasks.md` 第 1–5 组完成（第 6 组实机验收与发版由维护者执行）
- [x] `packages/opencode` 与 `sdks/vscode` 的 license 相关测试通过，两处 `bun typecheck` 通过
- [x] 仓库源码中不再出现旧共享密钥常量；git 中没有生产私钥

## 关闭说明（2026-11-20）

由 `11-20-state-cleanup` 复核后归档：`packages/opencode` license 测试 25 pass、`bun typecheck` 通过；`sdks/vscode` `check-types` 通过，`license.test.ts` 用临时 `vscode` 模块桩运行 5 pass（直接 `bun test` 会因缺 `vscode` 包失败，属基线登记的环境性问题）；扫不到旧密钥常量，git 中没有私钥。OpenSpec change `resolve-license-boundary` 保留，第 6 组（实机验收、客户 v2 重签、归档 change）由维护者执行。
