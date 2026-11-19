# Tasks

## 1. 隔离环境

- [x] 1.1 记录 `dev`、`origin/dev`、`v1.19.6` 的 SHA；从 `dev` 建分支 `sync-v1-19-6`（主工作区，原因见 design"隔离方式"）：`dev` = `origin/dev` = `90bd7d514d`，`v1.19.6` = `f4e363c829`
- [x] 1.2 建 pure upstream v1.19.6 对照 worktree，供失败归因：复用 `.worktrees/upstream-1.18.30-audit`，检出 `v1.19.6` 并 `bun install`

## 2. 合并与冲突

- [x] 2.1 `git merge v1.19.6`，按 design 的冲突表逐个解决；无法判断的停下列入阻塞清单：16 个冲突按冲突表解决，无阻塞项；另含会话分享停用的适配（见 design）
- [x] 2.2 合并后检查 `bun.lock` 与依赖安装，确认能构建：Bun 升到 1.4.4（便携版，见 design），`bun install --frozen-lockfile` 下 `bun.lock` 无变化

## 3. 产品适配

- [x] 3.1 更新渠道：`upgrade()` 恒返回 `undefined`；TUI 不注册 `/update`；`hypercode upgrade` 输出中文提示并以非零退出：开关集中在 `Brand.updateChannel`；`upgrade --major` 同时隐藏
- [x] 3.2 为 3.1 加回归测试（`autoupdate` 省略、`true`、`"notify"` 三种情况；命令列表不含 `/update`）：`hypercode-update-channel.test.ts` 5 条，已做变异验证。`upgrade()` 在读取 `autoupdate` 之前返回，三种配置共用一条断言
- [x] 3.3 本地化审计：处理 `localization-audit` 基线的增减；新增用户可见英文按 TUI/CLI 规范本地化：补 4 条描述翻译和 `import` 报错翻译；运行时基线 `pr.ts` 6→3、`upgrade.ts` 10→15（不可达，已注明）；help 快照只少了 `upgrade` 与 `--major`
- [x] 3.4 版本号升到 1.19.6（VSIX、CLI、离线包名），检查文档中写死的 1.18.30：Product、VSIX、CLI 均为 1.19.6；用户文档改为 1.19.6 包名，新增《1.19.6 升级说明》

## 4. 审查

- [x] 4.1 Product Default Review：逐项确认 design 中的结论，补充合并中新发现的默认值变更：更新渠道 `PRESERVE_HYPERCODE_DEFAULT`；会话分享 `ACCEPT_UPSTREAM_DEFAULT`（维护者决定）；其余四项 `ACCEPT_UPSTREAM_DEFAULT`，用户文档的 `debug config` 示例不含明文凭据
- [x] 4.2 Cross-Host Product Contract Review：`/update`、`/status`、`/variants`、浏览器打开：`/update` 与会话分享 `CROSS_HOST_CONTRACT_PRESERVED`；`/status`、浏览器打开不涉及 Product 契约；`/variants` 由服务端模型列表驱动，两端同源，列入人工验收
- [x] 4.3 `bun run rebrand:check` 与基线签名对比：Blocked 0、Planned/Patchable 0/0、Manual 1，与基线一致
- [x] 4.4 宿主对等清单（验收前由维护者指出遗漏后补做）：逐条列出 6 组 TUI 实质改动在扩展侧的结论；补齐 `/status` 插件列表与远端配置认证失败提示（Product 新增 `deriveProductPlugins`、`error.config.remote_auth`），修正 TUI 提示中的 `opencode auth login` 品牌残留；代码高亮映射的既有差距另行立项。规则已写入《上游同步工作流总纲》"宿主对等清单"

## 5. 验证

- [x] 5.1 五个包 typecheck：五个包通过（VSCode 为 `check-types`）
- [x] 5.2 五个包全量测试，与已知失败签名对比并归因，新回归为 0：无新回归，归因见同步报告；商店版 PowerShell 的 Bun 1.4.4 问题已回移植 upstream 修复
- [x] 5.3 重测 fork tax，更新基线文档并解释差异：224 / 153 / 66 / 1574（相对 v1.19.6），差异已写入 `reports/slimming/post-slimming-baseline.md`

## 6. 产物与报告

- [x] 6.1 打包 Windows EXE、VSIX、Ubuntu 离线包，记录 SHA-256，完成内置冒烟与品牌检查：EXE `8415d423…`、VSIX `e01bf1d1…`、Ubuntu 离线包 `a5c54d98…`；构建顺序与环境要求见同步报告
- [x] 6.2 在 `docs/阶段记录/` 输出同步报告（总纲要求的各项问题），更新升级说明：`docs/阶段记录/专项_上游同步影响_20261118.md`；升级说明为 `docs/用户指南/1.19.6升级说明.md`
- [x] 6.3 生成人工验收清单，状态标为 `READY_FOR_HUMAN_VSIX` 或 `NEEDS_HUMAN_DECISION`：`docs/阶段记录/验收清单_v1.19.6同步_20261118.md`，状态 `READY_FOR_HUMAN_VSIX`

## 7. 合入（人工验收通过后）

- [x] 7.1 维护者确认后，`dev` 合入 `sync-v1-19-6` 并推送：维护者 2026-11-19 确认验收完毕；`origin/dev` 未前进，`dev` 快进合入后推送
- [x] 7.2 归档本 change，把 spec delta 同步到 `openspec/specs/product-default-policy`：新增要求"交付版不使用 upstream 更新渠道"，`openspec validate --specs` 通过；归档到 `openspec/changes/archive/2026-11-19-sync-upstream-v1-19-6/`
