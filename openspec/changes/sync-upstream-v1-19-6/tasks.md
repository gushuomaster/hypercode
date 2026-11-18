# Tasks

## 1. 隔离环境

- [ ] 1.1 记录 `dev`、`origin/dev`、`v1.19.6` 的 SHA；从 `dev` 建分支 `sync-v1-19-6`（主工作区，原因见 design"隔离方式"）
- [ ] 1.2 建 pure upstream v1.19.6 对照 worktree，供失败归因

## 2. 合并与冲突

- [ ] 2.1 `git merge v1.19.6`，按 design 的冲突表逐个解决；无法判断的停下列入阻塞清单
- [ ] 2.2 合并后检查 `bun.lock` 与依赖安装，确认能构建

## 3. 产品适配

- [ ] 3.1 更新渠道：`upgrade()` 恒返回 `undefined`；TUI 不注册 `/update`；`hypercode upgrade` 输出中文提示并以非零退出
- [ ] 3.2 为 3.1 加回归测试（`autoupdate` 省略、`true`、`"notify"` 三种情况；命令列表不含 `/update`）
- [ ] 3.3 本地化审计：处理 `localization-audit` 基线的增减；新增用户可见英文按 TUI/CLI 规范本地化
- [ ] 3.4 版本号升到 1.19.6（VSIX、CLI、离线包名），检查文档中写死的 1.18.30

## 4. 审查

- [ ] 4.1 Product Default Review：逐项确认 design 中的结论，补充合并中新发现的默认值变更
- [ ] 4.2 Cross-Host Product Contract Review：`/update`、`/status`、`/variants`、浏览器打开
- [ ] 4.3 `bun run rebrand:check` 与基线签名对比

## 5. 验证

- [ ] 5.1 五个包 typecheck
- [ ] 5.2 五个包全量测试，与已知失败签名对比并归因，新回归为 0
- [ ] 5.3 重测 fork tax，更新基线文档并解释差异

## 6. 产物与报告

- [ ] 6.1 打包 Windows EXE、VSIX、Ubuntu 离线包，记录 SHA-256，完成内置冒烟与品牌检查
- [ ] 6.2 在 `docs/阶段记录/` 输出同步报告（总纲要求的各项问题），更新升级说明
- [ ] 6.3 生成人工验收清单，状态标为 `READY_FOR_HUMAN_VSIX` 或 `NEEDS_HUMAN_DECISION`

## 7. 合入（人工验收通过后）

- [ ] 7.1 维护者确认后，`dev` 合入 `sync-v1-19-6` 并推送
- [ ] 7.2 归档本 change，把 spec delta 同步到 `openspec/specs/product-default-policy`
