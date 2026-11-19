# Design

## 基线与目标

| 项 | 值 |
| --- | --- |
| 正式主线 | `dev` = `90bd7d514`（已与 `origin/dev` 一致） |
| 同步基线 | `193de13a88d62a6409c6d385831180f1def527dc`（v1.18.30 之后的 upstream `dev` 提交） |
| 目标 | `v1.19.6` = `f4e363c829`（2026-11-17），基线是其祖先，209 个提交，581 个文件 |
| fork tax 基线 | `221 / 149 / 62 / 1538`（`reports/slimming/post-slimming-baseline.md`） |
| 不同步 | 2.x（v2.3.2）：HyperCode 的挂载文件在 2.x 已删除，另行立项 |

## 隔离方式

按《上游同步工作流总纲》的"等价隔离环境"：从 `dev` 建分支 `sync-v1-19-6`，在主工作区中执行 `git merge v1.19.6`。不用新 worktree 的原因：Windows 上新 worktree 的依赖安装曾因 `tree-sitter-powershell` 原生编译失败，VSCode 测试结果不可靠；主工作区依赖完整。合并、适配、验证、打包都在该分支完成。人工验收通过前，`dev` 不动、不推送。合并提交保留 upstream 历史（不 squash），便于下一次同步以 v1.19.6 为基线。

## 冲突处理（2026-11-18 试合并，16 个）

| 文件 | 方向 |
| --- | --- |
| `.gitignore` | 两边合并 |
| `.github/workflows/pr-management.yml` | 取 upstream（CI 不在交付面；HyperCode 侧改动若只是品牌化，保留） |
| `.opencode/command/changelog.md`、`translate.md` | 取 upstream 的 `model`，保留 `description_i18n` |
| `packages/opencode/script/build.ts` | 保留 upstream 构建改动与 HyperCode 产物命名、品牌注入 |
| `packages/opencode/src/cli/cmd/github.handler.ts`、`pr.ts` | 取 upstream 功能，保留 `UI.product` 等品牌化 |
| `packages/opencode/src/cli/cmd/upgrade.ts` | 见"更新渠道" |
| `packages/tui/src/app.tsx` | 取 upstream 的 `openUrl` 重构等；保留本地化与 Product 命令目录；不注册 `/update` |
| `packages/tui/src/routes/home.tsx`、`session/index.tsx`、`session/sidebar.tsx`、`feature-plugins/home/tips-view.tsx` | 取 upstream 功能，保留 HyperCode 文案；更新提示相关的接入不保留 |
| `sdks/vscode/package.json` | `version` 取 `1.19.6`，`publisher` 等品牌字段保持 HyperCode |
| `packages/opencode/test/cli/run/run-process.test.ts`、`test/share/share-next.test.ts` | 按功能合并 |

无法判断保留哪一侧时停止，列入阻塞清单交维护者。

## 更新渠道（Product Default Review：`PRESERVE_HYPERCODE_DEFAULT`）

upstream v1.19.x 的行为：省略 `autoupdate` 时联网检查版本；TUI 弹出 `/update` 对话框与更新提示；1.x 已最新时推销并安装 OpenCode 2.0；`opencode upgrade` 从 upstream 渠道安装。

HyperCode 的处理（已实施）。唯一开关是 HyperCode 自有的 `packages/opencode/src/brand.ts` 中的 `Brand.updateChannel`（当前为 `undefined`）；将来有自己的更新渠道时只改这一处：

1. `packages/opencode/src/cli/upgrade.ts` 的 `upgrade()` 在没有渠道时开头直接返回，早于读取 `autoupdate` 配置和任何网络请求，所以 `autoupdate` 省略、为 `true` 或 `"notify"` 结果相同。
2. `packages/opencode/src/cli/cmd/tui.ts` 在没有渠道时不创建 updater。TUI 的更新提示与 `/update` 都以 updater 存在为前提，因此不会出现；`packages/tui/src/app.tsx` 另外删掉了 upstream 的 `/update` 注册块（其英文标题也会被 `hardcoded-copy` 审计拦下）。`packages/tui/test/product/command-adapter.test.ts` 的 host_only 白名单保持不变。
3. `cli/cmd/upgrade.ts`：没有渠道时命令和 `--major` 选项都从帮助中隐藏；handler 开头输出本地化提示"HyperCode 没有在线更新渠道，请向管理员获取新的安装包。"并以退出码 1 结束。命令保留，以免旧文档中的 `hypercode upgrade` 报"未知命令"。
4. 新增 `dialog-update.tsx`、`update-notification.tsx` 原样保留（upstream 文件，不本地化）。因为不可达，不加入 `hardcoded-copy` 清单；由第 5 条的测试保证不可达。`cmd/upgrade.ts` 中 upstream 新增的 OpenCode 2 安装输出同样不可达，`localization-audit` 运行时英文基线从 10 调到 15 并注明原因。
5. 回归测试 `packages/opencode/test/cli/hypercode-update-channel.test.ts`：`Brand.updateChannel` 为空；`upgrade()` 返回 `undefined`；`hypercode upgrade` 中英文提示与退出码 1，`upgrade --major` 与 `upgrade --help` 不含"OpenCode 2"；`--help` 不列出 `upgrade`；`app.tsx` 不注册 `slashName: "update"`。变异验证：把 `updateChannel` 临时设为非空后，前四类断言全部失败。

`HYPERCODE_DISABLE_AUTOUPDATE=1` 继续保留在离线模板里，作为双保险。

`packages/desktop` 的 OpenCode 2 升级推销不处理：桌面版不在交付面，按 upstream 原样接收。

## 会话分享停用（维护者决定：跟随 upstream）

upstream `d320177aa4`（#55718）停止会话分享服务：服务端分享接口返回 "Session sharing has been discontinued"，`run --share` 隐藏并失效，`import` 不再接受分享 URL，TUI 删除 `/share`、`/unshare` 和侧栏分享链接。HyperCode 1.18.30 在 TUI 与 VSCode 都提供分享，若只合并 upstream，VSCode 仍会显示调用必然失败的入口。2026-11-18 维护者选择"跟随上游停用"。分类 `explicit_unsupported`，结论 `ACCEPT_UPSTREAM_DEFAULT`。

- Product 统一裁决（两端不各自实现）：`packages/product/src/command.ts` 的 `discontinuedCommands` 使 `session.share`、`session.unshare` 在任何宿主上都是 `unsupported`，与宿主是否声明支持无关；`session-mutation.ts` 的 `supports()` 对两者恒返回 `false`。
- TUI：接受 upstream 删除；首页提示与 i18n 删除 `tip.share`、`tip.shareAuto`、`tip.shareDisabled`、`tip.unshare`（以及指向更新渠道的 `tip.upgrade`）。
- VSCode：`package.json` 删除会话树行内菜单中的分享项，命令面板以 `when: false` 隐藏 `hypercode.shareSession`、`hypercode.unshareSession`；命令 ID 保留，避免用户自定义快捷键报"命令不存在"。
- 本地化：`import` 的新报错改用 `cliText()`，补中文；`run --share` 的弃用说明与 `import` 新描述补字典。
- 测试：Product、TUI、VSCode 的契约与 parity 测试改为期望 `unsupported`；原用 share 演示宿主失败的测试改用 rename / archive。

## 运行时版本：Bun 1.4.4

upstream v1.19.6 把 `packageManager` 从 `bun@1.3.14` 升到 `bun@1.4.4`（构建脚本也依赖 1.4.4 的 musl 原生包行为）。EXE 内嵌 Bun 运行时，因此测试与打包都用 1.4.4。为不改动本机全局 Bun，从 npm registry 的 `@oven/bun-windows-x64@1.4.4` 取便携版放在 `D:\tmp-hc\bun-1.4.4`，验证与打包时放在 `PATH` 最前；`bun install --frozen-lockfile` 下 `bun.lock` 无变化。`plugin.openai.ws` 用例在 1.3.14 下失败、1.4.4 下通过，属于环境归因。

离线构建脚本 `script/build-offline-linux.ts`、`build-offline-windows.ts` 的交叉编译器校验和改为 Bun 1.4.4 官方 `SHASUMS256.txt` 中的值，Windows 脚本的版本检查改为 `1.4.4`。

Bun 1.4.4 对 Microsoft Store 版 PowerShell 7 的应用执行别名（`%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`）调用 `stat` 会抛出 `EACCES`。v1.19.6 的 `packages/core/src/shell.ts` 会对配置的 shell 和 `Shell.list()` 的候选执行 `stat`，所以装了商店版 pwsh 的 Windows 用户在配置 `shell: "pwsh"` 时 shell 工具初始化失败，PTY 的 shell 列表接口也会报错。pure upstream v1.19.6 在 1.4.4 下同样失败（`tool.shell` 的 `[pwsh]` 用例，HyperCode 分支上为 26 个），upstream 只在 2.x 的 `b6cfbec4cc`（#61952）中修复。1.18.30 交付版（Bun 1.3.14）没有这个问题，属于对交付用户的回退，因此回移植该修复的最小部分：`packages/core/src/util/which.ts` 的 `isAppExecutionAlias()`，`shell.ts` 的 `resolve()` 先判断别名再 `stat`，以及 upstream 的测试 fixture `test/fixture/app-execution-alias.ts` 和一条 core 测试（本机有商店应用时执行，否则跳过）。变异验证：去掉别名判断后该用例失败。下次同步到 2.x 时以 upstream 实现为准。

## 其他 Product Default Review

| upstream 变更 | 结论 |
| --- | --- |
| `debug config` 输出脱敏凭据 | `ACCEPT_UPSTREAM_DEFAULT`；核对用户文档中的示例输出 |
| Gemini 思考参数默认逻辑 | `ACCEPT_UPSTREAM_DEFAULT` |
| 按配置的推理选项生成 variants | `ACCEPT_UPSTREAM_DEFAULT`；验证 `/variants` 在 TUI 与 VSCode 结果一致 |
| 历史图片重发上限（v1.19.6） | `ACCEPT_UPSTREAM_DEFAULT` |

合并后若发现上表之外、触及默认值的变更，补充审查；无法定结论时标 `NEEDS_HUMAN_DECISION` 并停止。

## Cross-Host Product Contract Review

- `/update`：不注册，两端都不出现，`CROSS_HOST_CONTRACT_PRESERVED`。
- 会话分享：由 Product 统一判定为 `unsupported`，TUI 与 VSCode 结果一致，`CROSS_HOST_CONTRACT_PRESERVED`（见"会话分享停用"）。
- `/status` 插件列表：扩展原本没有插件区块。插件名解析移入 `packages/product`（`deriveProductPlugins`），TUI 与扩展共用，`CROSS_HOST_CONTRACT_ADAPTED`。
- 远端配置认证失败（upstream #49016）：Product 新增 `error.config.remote_auth`，扩展面板显示中文重新登录说明；TUI 提示中的 `opencode auth login` 改为 `hypercode`，`CROSS_HOST_CONTRACT_ADAPTED`。
- 浏览器打开逻辑统一到 `@opencode-ai/core/open`：VSCode 使用 `openExternal`，`host_only`。
- C++ 模块文件高亮：扩展按内容自动识别，结果未变差；扩展名映射与 TUI 的既有差距另行立项。
- `/variants`：见上表。

完整的宿主对等清单见专项报告第 4.1 节。

## 验证

1. 五个包 typecheck：`packages/product`、`packages/core`、`packages/tui`、`packages/opencode`、`sdks/vscode`。
2. 全量测试，与基线文档的已知失败签名逐条对比；新失败先在 `dev` worktree 复跑，再在 pure upstream v1.19.6 worktree 复跑，按"新回归 / upstream / 环境"归因。新回归必须修复或升级为人工决策。
3. `bun run rebrand:check` 与基线签名（Blocked 0、Planned/Patchable 0/0、Manual 1）对比。
4. `packages/opencode/test/cli/localization-audit.test.ts` 的运行时英文基线：增加的条目本地化，减少的下调基线。
5. `-Mode Measure -CurrentRef HEAD` 重测 fork tax，解释与 `221 / 149 / 62 / 1538` 的差异。
6. 打包 Windows EXE、VSIX、Ubuntu 离线包，记录 SHA-256；EXE 内置冒烟、VSIX 品牌检查。

## 交付与回滚

- 目标状态 `READY_FOR_HUMAN_VSIX`：产物与人工验收清单交维护者。
- 人工验收通过且维护者确认后，`dev` 快进或合并 `sync-v1-19-6`，再推送。
- 回滚：验收前删除 worktree 与分支即可，`dev` 未受影响；合入后回滚用 `git revert -m 1 <合并提交>`。
