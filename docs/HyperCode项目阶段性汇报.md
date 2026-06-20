# HyperCode 项目阶段性汇报

## 一、项目目标

本项目的目标不是简单地把 `OpenCode` 字符串全局替换成 `HyperCode`，而是构建一个可长期维护的 **HyperCode 品牌化发行版**。

整体目标包括三点：

1. **品牌化交付**  
   将 OpenCode 面向用户的显示层改造为 HyperCode，包括 CLI、TUI、VSCode 插件、exe、VSIX、文档和交付物命名。

2. **用户使用方式收敛**  
   最终用户主要通过 Windows 可执行文件 `hypercode.exe` 和 VSCode 插件 `hypercode.vsix` 使用，不需要接触源码安装和内部工程结构。

3. **保留上游同步能力**  
   HyperCode 仍然基于 OpenCode 上游项目维护，未来 OpenCode 更新后，HyperCode 能够通过规范化流程同步上游变化，同时保留 HyperCode 的品牌层和兼容能力。

---

## 二、总体技术方案

当前采用的是 **外部品牌化 + 内部兼容保留** 的方案。

也就是说：

- 用户可见层统一为 **HyperCode**；
- 内部兼容层保留必要的 `opencode` 标识；
- 上游仓库仍作为 `upstream`；
- HyperCode 私有仓库作为 `origin`；
- 通过 sync 分支合并 upstream 更新；
- 通过 hardened rebrand 脚本恢复用户可见品牌；
- 最终通过 exe / VSIX 做真实交付验证。

当前仓库关系如下：

```txt
origin   = https://github.com/gushuomaster/hypercode.git
upstream = https://github.com/anomalyco/opencode.git
upstream push = DISABLED
```

这样做的原因是：如果彻底全局替换 `opencode -> hypercode`，会破坏内部包名、import、provider id、VSCode command id、配置 fallback 和上游同步能力。因此当前方案更稳妥。

---

## 三、为什么不能全局替换

项目中存在大量内部协议和兼容项，例如：

```txt
@opencode-ai/*
packages/opencode
provider.id = "opencode"
opencode.* command id
OPENCODE_* fallback
.opencode fallback
opencode.json / opencode.jsonc fallback
```

这些并不是普通品牌文案，而是工程内部依赖、兼容入口或历史配置兼容层。

如果全局替换，可能导致：

1. TypeScript import 失效；
2. workspace 包依赖找不到；
3. VSCode 插件命令 ID 失效；
4. provider / 模型缓存匹配失败；
5. 旧配置无法读取；
6. CLI 兼容入口损坏；
7. 未来 upstream merge 冲突大幅增加；
8. license / upstream attribution 语义错误。

因此当前方案不是“全局替换”，而是：

```txt
用户看到的改成 HyperCode
机器依赖的兼容项保留 opencode
```

---

## 四、已完成工作

### 1. 仓库结构与上游关系

已建立 HyperCode 私有仓库，并配置：

- `origin` 指向 HyperCode 私有仓库；
- `upstream` 指向 OpenCode 官方仓库；
- `upstream push` 已禁用，避免误推上游。

这保证了后续可以安全地从 OpenCode 拉取更新，同时只向 HyperCode 仓库推送。

---

### 2. CLI / exe 品牌化

已经完成 Windows exe 相关品牌化验证：

- 构建产物目录从 `opencode-windows-x64` 改为 `hypercode-windows-x64`；
- exe 文件名改为 `hypercode.exe`；
- CLI help 顶部显示 `HyperCode`；
- subtitle 显示 `AI coding agent`；
- 启动界面不再显示旧的 `opencode` 大 logo；
- `OpenCode Zen` 运行时显示名已修复为 `HyperCode Zen`。

已验证：

```txt
hypercode.exe --help
hypercode.exe --version
```

均可正常执行。

---

### 3. VSCode 插件品牌化

VSCode 插件已完成关键品牌化：

- VSIX 文件名：`hypercode.vsix`；
- 插件 name：`hypercode`；
- displayName：`HyperCode`；
- description：`HyperCode for VS Code`；
- 插件 ID：`sst-dev.hypercode`；
- 插件启动命令从 `opencode --port` 修复为 `hypercode --port`；
- 终端标题显示 `HyperCode`。

同时保留内部 command id，例如 `opencode.openTerminal`。这类 ID 是插件内部协议，不作为用户可见残留处理。

---

### 4. Runtime Provider 显示名修复

运行时首页曾出现 `OpenCode Zen`，经定位发现它不是普通 UI 文案，而是来自 provider metadata 和本地缓存。

本地缓存中仍可能存在：

```txt
C:\Users\28320\.cache\opencode\models.json
"name": "OpenCode Zen"
```

当前采用更稳定的修复方式：

- 保留内部 provider id：`opencode`；
- 只 override 用户可见 display name 为：`HyperCode Zen`。

这样即使本地缓存中仍然存在 `OpenCode Zen`，运行时 UI 也会显示 `HyperCode Zen`。

---

### 5. Rebrand 脚本加固

原始 rebrand 脚本风险较高，会对 allowlist 文件做较粗的字符串替换，可能误改内部兼容项。

目前已完成脚本加固：

- 支持 dry-run；
- 支持 structured report；
- 支持 `protected` / `patchable` / `manual-check-required` 分类；
- 保护 `@opencode-ai/*`；
- 保护 `provider.id = "opencode"`；
- 保护 `opencode.*` internal command id；
- 保护 `OPENCODE_*` fallback；
- 保护 `.opencode` fallback；
- 保护 upstream attribution URL；
- 支持 synthetic safety drill。

当前 rebrand 脚本已经从“简单替换工具”升级为“品牌补丁审计与低风险修复工具”。

---

### 6. Upstream Sync Drill 已完成

已经多轮验证从 OpenCode upstream 同步的可行性。

验证结果：

- `git fetch upstream` 成功；
- upstream 默认分支确认为 `dev`；
- upstream 存在大量新增提交；
- merge upstream/dev 会产生真实冲突；
- 冲突主要集中在品牌层和运行时层；
- 人工解冲突后，核心链路可以恢复；
- `bun turbo typecheck` 可通过；
- `packages/opencode bun typecheck` 可通过；
- `packages/opencode bun run build --single` 可通过；
- `hypercode.exe` 可成功构建；
- VSIX 打包可通过，但需要在 `sdks/vscode` 下独立执行 `bun install`。

最终结论：

```txt
OpenCode upstream sync 可行，但需要人工解冲突和独立 VSIX 依赖安装。
```

---

### 7. 正式同步 SOP 文档已沉淀

已新增正式同步流程文档：

```txt
docs/hypercode-upstream-sync-procedure.md
```

文档中已写明：

- origin / upstream 关系；
- sync-drill 流程；
- 冲突处理原则；
- hardened rebrand dry-run / write 流程；
- 品牌检查清单；
- typecheck / build / exe 验证；
- `sdks/vscode` 独立 `bun install`；
- VSIX package 和解包检查；
- 禁止事项。

这意味着后续同步不再依赖临时经验，而是有正式 SOP。

---

## 五、当前进度判断

目前项目已经完成以下关键验证：

```txt
1. HyperCode 品牌化主链路已跑通；
2. exe 构建与运行已跑通；
3. VSIX 构建与插件启动链路已跑通；
4. 运行时 OpenCode / opencode 主要用户可见残留已处理；
5. rebrand 脚本已经加固；
6. upstream sync 流程已验证可行；
7. 同步 SOP 已文档化。
```

当前项目状态可以定义为：

```txt
HyperCode 已具备 branded fork 的基本维护能力。
```

但当前还不是最终正式发布状态，因为还需要完成一次正式 upstream sync 分支的完整执行，并经过最终人工验收后，才能考虑合并回 dev 和发布内部版。

---

## 六、技术难点

### 1. 品牌替换不能全局替换

OpenCode 项目内部大量 `opencode` 标识不是品牌文案，而是依赖结构、协议标识、provider id、配置兼容、VSCode command id。

难点在于要区分：

```txt
用户可见品牌：应该改成 HyperCode
内部兼容标识：应该保留 opencode
```

---

### 2. 上游同步会冲突

OpenCode upstream 有持续更新，且更新会触碰 CLI、TUI、VSCode、配置等核心区域。

这些区域恰好也是 HyperCode 品牌化修改过的区域，因此 merge 时必然有冲突。

典型高风险冲突文件包括：

```txt
packages/core/src/flag/flag.ts
packages/opencode/src/cli/logo.ts
packages/tui/src/app.tsx
packages/tui/src/attention.ts
packages/tui/src/routes/session/index.tsx
sdks/vscode/package.json
```

冲突解决必须同时保留 upstream 功能变化和 HyperCode 品牌修改，不能简单选 upstream 或 ours。

---

### 3. Provider 显示名来自缓存数据

`OpenCode Zen` 不是普通静态文案，而来自 provider metadata 和本地缓存。

如果只改 UI 文案，无法彻底解决。最终方案是在 provider 转换层做显示名 override：

```txt
provider.id 保留 opencode
provider.name 显示 HyperCode Zen
```

这是一个典型的“内部 ID 与用户显示名分离”的问题。

---

### 4. VSCode 插件是独立项目

`sdks/vscode` 不在 root workspace 中，不能假设 root `bun install` 会安装插件依赖。

如果未在 `sdks/vscode` 单独执行 `bun install`，会出现：

```txt
Cannot find module 'vscode'
Cannot find name 'setTimeout'
Cannot find name 'fetch'
```

这不是代码问题，而是依赖环境问题。

因此 VSIX 构建前必须执行：

```powershell
cd sdks/vscode
bun install
```

---

### 5. Rebrand 脚本需要非常谨慎

rebrand 脚本不能只是替换字符串，它必须具备：

- allowlist；
- blocklist；
- protected signal；
- manual-check-required；
- synthetic drill；
- dry-run report；
- write 前后保护检查。

否则会误改内部兼容项，导致构建或运行失败。

---

## 七、当前可行性结论

整体可行性判断：

```txt
可行。
但不是一键全自动可行，而是工程化流程可行。
```

### 已验证可行

```txt
1. 将用户可见层改造成 HyperCode；
2. 构建 hypercode.exe；
3. 构建 hypercode.vsix；
4. VSCode 插件调用 hypercode --port；
5. 保留 opencode 内部兼容层；
6. 从 upstream/dev 同步 OpenCode 更新；
7. 通过人工冲突解决恢复构建；
8. 使用 hardened rebrand 审计和恢复品牌层。
```

### 仍需人工参与

```txt
1. upstream merge 冲突需要人工解决；
2. 高风险品牌点需要人工确认；
3. exe / VSIX 需要人工最终验收；
4. sync 分支是否合回 dev 需要人工决策。
```

### 不建议做的事

```txt
1. 不建议全局替换 opencode -> hypercode；
2. 不建议直接在 dev 上 merge upstream；
3. 不建议未验证 exe / VSIX 就 release；
4. 不建议删除 opencode 兼容入口；
5. 不建议删除 OPENCODE / .opencode fallback。
```

---

## 八、下一步计划

当前下一步建议是执行正式 upstream sync，而不是直接发布。

推荐流程：

```txt
1. 在干净 worktree 中从 dev 开始；
2. 创建正式 sync 分支；
3. merge upstream/dev；
4. 人工解决冲突；
5. 运行 hardened rebrand dry-run；
6. dry-run 合理后运行 rebrand write；
7. 完成品牌检查；
8. 完成 typecheck/build；
9. 完成 exe 验证；
10. 在 sdks/vscode 下独立 bun install；
11. 打包并解包检查 VSIX；
12. 清理 node_modules/dist 等产物；
13. 提交并 push sync 分支到 origin；
14. 等待人工确认后再 merge 回 dev；
15. dev 验证通过后，再准备 v0.1.0-internal artifacts。
```

---

## 九、阶段性结论

本项目目前已经从“单纯改名尝试”推进到“可维护 branded fork 方案”。

阶段性成果是：

```txt
HyperCode 可以作为 OpenCode 的品牌化发行版本继续推进。
```

当前最重要的结论是：

```txt
OpenCode 更新后，HyperCode 可以同步，但需要严格流程：
干净 dev -> sync 分支 -> 人工解冲突 -> hardened rebrand -> typecheck/build -> exe/VSIX 验收。
```

因此，该项目具备继续推进价值。下一阶段重点不是扩大替换范围，而是完成正式 upstream sync 分支，并在验证通过后决定是否合回 dev，随后进入 v0.1.0-internal 内部版发布准备。
