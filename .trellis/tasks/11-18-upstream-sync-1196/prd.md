# 同步 upstream OpenCode v1.19.6（sync-upstream-v1-19-6）

## Goal

在隔离 worktree 中合入 upstream v1.19.6（`f4e363c829`），吸收 upstream 修复，同时保持产品是 HyperCode：品牌、中文体验、Product 跨宿主契约、授权门禁都不被覆盖。

## Requirements

需求以 `openspec/changes/sync-upstream-v1-19-6/proposal.md` 与 `openspec/changes/sync-upstream-v1-19-6/specs/product-default-policy/spec.md` 为准，本文件不重复：

- 遵循 `docs/规范/上游同步工作流总纲.md`：隔离执行，人工验收前不动 `dev`、不推送
- 交付版不检查、不提示、不安装 upstream 更新，不出现 OpenCode 2.0 推销（`PRESERVE_HYPERCODE_DEFAULT`）
- 品牌化遵循 `docs/规范/上游同步与品牌化规范.md`
- 最小必要适配，fork tax 的增量必须可解释

## Acceptance Criteria

- [ ] 16 个冲突全部解决，无遗留冲突标记
- [ ] 更新渠道的回归测试通过：`upgrade()` 不发起检查，`hypercode upgrade` 输出中文提示，命令列表没有 `/update`
- [ ] 五个包 typecheck 通过；全量测试与已知失败签名对比，新回归为 0
- [ ] `rebrand:check` 签名不劣于基线
- [ ] fork tax 已重测，差异已解释
- [ ] EXE、VSIX、Ubuntu 离线包已生成并记录 SHA-256；同步报告与人工验收清单已交维护者
