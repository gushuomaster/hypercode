# HyperCode 与 opencode 差异维护及上游同步依据

## 1. 文档目的

这份文档不是自动同步脚本，也不是 release 文档。

它的作用是：

- 记录当前 HyperCode 相对固定 opencode 基线的真实 Git 差异
- 为后续 upstream sync、rebrand、冲突处理和回归验证提供依据
- 明确哪些 HyperCode 特性必须保留，哪些内容不允许被 upstream 恢复

它不能：

- 自动同步 upstream
- 自动解决冲突
- 替代人工 review

如果后续要做自动化，应该把本文记录的规则下沉为独立脚本，而不是把本文本身当作脚本替代物。

## 2. 基线信息

### 当前 HyperCode 状态

- HyperCode branch: `feature/vscode-extension-integration`
- HyperCode HEAD: `b4067cf2e7cacfdd2642761dad291ee7ade069f0`
- HyperCode HEAD date: `2026-06-11 11:41:31 +0800`
- HyperCode HEAD subject: `docs: add HyperCode upstream sync and rebrand guide`
- 当前已确认的 VS Code 扩展特性提交: `752a64ee989cdb9897d87b2dfd9b8f2debcdd2f6`

### 固定 opencode 基线

- opencode base: `0050134d9eca104b7e38b52b6f0aa62b8c0926db`
- opencode base date: `2026-06-08 13:02:10 +0530`
- opencode base subject: `fix(session): merge per-call tool rules into session permission (#30529)`
- opencode describe / tag: `github-v1.2.25-216-g0050134d9`

### 工作区事实

- 本次文档整理开始时，工作区没有待改 tracked 文件
- 未跟踪参考项为：
  - `extensions.rar`
  - `extensions/`
- 这两个路径仅作为参考源，不参与当前文档维护

### 对比命令

本文基于固定 hash，而不是浮动的 `upstream/dev` 进行差异维护：

```powershell
git merge-base HEAD upstream/dev
git log -1 --format="HyperCode HEAD: %H%nDate: %ci%nSubject: %s" b4067cf2e7cacfdd2642761dad291ee7ade069f0
git log -1 --format="opencode base: %H%nDate: %ci%nSubject: %s" 0050134d9eca104b7e38b52b6f0aa62b8c0926db
git describe --tags --always 0050134d9eca104b7e38b52b6f0aa62b8c0926db
git diff --name-status 0050134d9eca104b7e38b52b6f0aa62b8c0926db..b4067cf2e7cacfdd2642761dad291ee7ade069f0
git diff --stat 0050134d9eca104b7e38b52b6f0aa62b8c0926db..b4067cf2e7cacfdd2642761dad291ee7ade069f0
```

## 3. 当前差异总览

基于 `git diff --stat 0050134d9eca104b7e38b52b6f0aa62b8c0926db..b4067cf2e7cacfdd2642761dad291ee7ade069f0`，当前 HyperCode 相对该 opencode 基线共有：

- `313` 个文件变更
- `50004` 行新增
- `581` 行删除

真实变化主要集中在这些区域：

- 根级品牌和元数据：`.gitignore`、`README.md`、`package.json`、`bun.lock`
- rebrand 与同步支撑文档/脚本：`docs/*`、`scripts/rebrand-opencode-to-hypercode.mjs`、`scripts/sync-opencode-upstream.ps1`
- app / tui / opencode 用户可见文本与 CLI 面：`packages/app/src/i18n/*`、`packages/opencode/src/cli/*`、`packages/opencode/src/config/*`、`packages/opencode/src/session/prompt/*`、`packages/tui/src/*`
- VS Code 扩展增强：`sdks/vscode/*`

## 4. 差异分组说明

### 4.1 品牌化 / rebrand

#### 涉及文件

- `README.md`
- `package.json`
- `packages/app/src/i18n/*`
- `packages/opencode/src/cli/*`
- `packages/opencode/src/config/*`
- `packages/opencode/src/session/prompt/*`
- `packages/tui/src/*`
- `scripts/rebrand-opencode-to-hypercode.mjs`
- `docs/hypercode-rebrand-audit.md`
- `docs/hypercode-rebrand-report.md`

#### 改动目的

- 把用户可见品牌、CLI 文案、配置与提示词表述从 opencode 层转换为 HyperCode

#### 改动方式

- 真实 diff 显示这里主要是文本替换、提示文案调整、品牌名和命令名人工收敛
- 同时新增了 rebrand 审计和重放脚本，用于后续检查与重复执行

#### 同步策略

- 用户可见品牌面必须保留，并在每次 upstream 同步后重放或复核
- 第三方依赖名、license 文本、兼容字段不能机械替换，必须人工合并

### 4.2 VS Code 扩展增强

#### 涉及文件

- `sdks/vscode/package.json`
- `sdks/vscode/README.md`
- `sdks/vscode/esbuild.js`
- `sdks/vscode/tsconfig.json`
- `sdks/vscode/.vscodeignore`
- `sdks/vscode/images/*`
- `sdks/vscode/media/hypercode.svg`
- `sdks/vscode/src/bridge/*`
- `sdks/vscode/src/core/*`
- `sdks/vscode/src/panel/*`
- `sdks/vscode/src/sidebar/*`
- `sdks/vscode/src/test/*`
- `sdks/vscode/src/extension.ts`

#### 改动目的

- 把原先轻量终端启动器升级为完整 HyperCode VS Code 集成

#### 改动方式

- 真实 diff 显示新增了 `bridge / core / panel / sidebar / webview / test` 结构
- 重建了命令面、工作区运行时、Session Panel、Activity Bar 容器、Sessions 树与附属视图
- 同时补齐构建入口、资源文件和大量纯逻辑/渲染测试

#### 同步策略

- 这是 HyperCode 当前最重的产品增强层
- 未来 upstream 同步时不能简单覆盖，必须人工合并，并优先保留增强能力

### 4.3 license 门禁移除

#### 涉及文件

- 当前相对 `OPENCODE_BASE..HEAD` 的真实 diff 中，没有单独出现 `src/license/*` 这类上游基线差异项
- 但在已确认的扩展特性提交 `752a64ee989cdb9897d87b2dfd9b8f2debcdd2f6` 和当前 `HEAD` 上，已经验证：
  - `sdks/vscode/package.json`
  - `sdks/vscode/README.md`
  - `sdks/vscode/src`
  - `sdks/vscode/src/test`
  中不存在 `openLicenseFile`、`src/license`、授权阻断、授权测试相关内容

#### 改动目的

- 维持 HyperCode 当前无 license 门禁的通用版行为

#### 改动方式

- 这里的依据不是“相对上游基线直接能看到的一组删除文件”
- 而是通过当前 HyperCode 扩展提交和当前 HEAD 的实际内容验证，确认授权入口和授权阻断没有出现在当前状态中

#### 同步策略

- 如果 future upstream 或后续人工合并重新带回授权入口、授权阻断或授权测试，必须人工剔除
- 这是禁止恢复项，不允许被 upstream 覆盖回来

### 4.4 构建和打包配置

#### 涉及文件

- 根级：`bun.lock`
- `packages/opencode/script/build.ts`
- `packages/opencode/package.json`
- `sdks/vscode/esbuild.js`
- `sdks/vscode/tsconfig.json`
- `sdks/vscode/.vscodeignore`
- `sdks/vscode/bun.lock`
- `sdks/vscode/script/publish`

#### 改动目的

- 支撑 HyperCode 当前产品形态和增强版 VS Code 扩展打包

#### 改动方式

- 真实 diff 显示这里涉及构建脚本、打包入口、锁文件和发布脚本调整

#### 同步策略

- 构建配置是高冲突面
- 上游若改动同文件，必须人工合并，不能整块覆盖

### 4.5 README / 文档

#### 涉及文件

- `README.md`
- `sdks/vscode/README.md`
- `docs/hypercode-binary-plugin-distribution.md`
- `docs/hypercode-upstream-sync-procedure.md`
- `docs/hypercode-upstream-sync-and-rebrand.md`

#### 改动目的

- 把根 README 与扩展 README 从 opencode / 旧启动器叙事转向 HyperCode 产品描述
- 补充上游同步、rebrand 和分发说明文档

#### 改动方式

- 真实 diff 显示这里既有品牌文案调整，也有新增的维护说明文档

#### 同步策略

- README 是品牌与产品行为边界文件
- 每次 upstream 更新后必须人工复核，尤其是 `sdks/vscode/README.md` 不能退回旧终端启动器叙事

### 4.6 依赖策略

#### 涉及文件

- `bun.lock`
- `sdks/vscode/bun.lock`
- `package.json`
- `packages/opencode/package.json`

#### 改动目的

- 记录当前 HyperCode 与 opencode 基线在依赖和包元数据层面的真实差异

#### 改动方式

- 真实 diff 中确实包含 lockfile 和 package 元数据变化
- 但当前 diff 不能支持进一步夸大为更具体的依赖政策结论

#### 同步策略

- 锁文件通过包管理器更新，不手工改内容
- 依赖面改动跟随产品需要人工检查

### 4.7 其他真实存在的改动

#### 涉及文件

- `scripts/sync-opencode-upstream.ps1`
- `docs/hypercode-rebrand-audit.md`
- `docs/hypercode-rebrand-report.md`

#### 改动目的

- 为后续 upstream 同步和 rebrand 留下人工维护支撑材料

#### 改动方式

- 新增同步辅助脚本与差异审计文档

#### 同步策略

- 这些内容属于 HyperCode 维护层，应随产品保留，但需要根据未来流程变化人工更新

## 5. 差异处理矩阵

这一节把当前 `BASE..HEAD` 真实差异、`752a64ee989cdb9897d87b2dfd9b8f2debcdd2f6` 提交内容，以及当前 `HEAD` 状态扫描拆成可执行的维护矩阵。

这里的证据来源只允许落在三类范围内：

- 证据：`BASE..HEAD diff`
- 证据：`752a64e` 自定义提交
- 证据：当前 `HEAD` 状态检查

其中第三类只用于描述“当前状态必须维持什么”，不能伪装成“opencode 基线里原本有什么差异”。

| 差异类型 | 代表文件 | 证据来源 | 当前差异说明 | 后续同步策略 | 可脚本化程度 | 人工验证要求 | 验证方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 品牌化与用户可见文案 | `README.md`、`package.json`、`packages/app/src/i18n/*`、`packages/opencode/src/cli/*`、`packages/opencode/src/config/*`、`packages/opencode/src/session/prompt/*`、`packages/tui/src/*`、`scripts/rebrand-opencode-to-hypercode.mjs` | 证据：`BASE..HEAD diff` | 真实 diff 显示品牌文案、CLI 提示、配置描述和部分提示词表述发生变化，并新增 rebrand 脚本支撑重复执行 | 保留 HyperCode 品牌面；同步后先跑脚本和残留扫描，再人工复核第三方名词、兼容字段和协议文本 | 部分可脚本化 | 必须人工抽查用户可见文案与兼容字段 | `rg -n "opencode|OpenCode|opencode-ai" .` |
| 公开命令和配置命名 | `sdks/vscode/package.json`、`sdks/vscode/src/core/commands.ts`、`sdks/vscode/src/core/settings.ts`、`README.md`、`sdks/vscode/README.md` | 证据：`BASE..HEAD diff` + `752a64e` 自定义提交 + 当前 `HEAD` 状态检查 | 扩展公开入口已经以 `hypercode.*` 为主，`hypercode.cliPath`、`hypercode.httpProxy` 已在当前状态中存在；`opencode.*` 仍可能作为兼容测试或内部引用残留 | 保留 `hypercode.*` 主命名；不要机械清空全部 `opencode.*` 命中，需区分兼容字段和内部路径 | 可脚本检查，不适合全自动改写 | 必须人工确认对外命令和设置名是否仍符合产品命名 | `rg -n "hypercode\\.|opencode\\.|openLicenseFile" sdks/vscode/package.json sdks/vscode/README.md sdks/vscode/src` |
| VS Code 扩展产品增强 | `sdks/vscode/src/extension.ts`、`sdks/vscode/src/bridge/*`、`sdks/vscode/src/core/*`、`sdks/vscode/src/panel/*`、`sdks/vscode/src/sidebar/*`、`sdks/vscode/images/*`、`sdks/vscode/media/*`、`sdks/vscode/package.json`、`sdks/vscode/README.md`、`sdks/vscode/esbuild.js`、`sdks/vscode/tsconfig.json`、`sdks/vscode/.vscodeignore` | 证据：`BASE..HEAD diff` + `752a64e` 自定义提交 | 真实 diff 和扩展特性提交都表明这是当前最重的产品增强层，包含 Activity Bar、Sessions、Todo、Modified Files、Subagents、Session Panel、runtime 对接和大量测试 | upstream 改到同名文件时必须人工三方合并；不能把这一层交给脚本重写或整块覆盖 | 只能脚本检查构建结果 | 必须人工验证扩展实际体验和关键交互 | `cd D:\\project\\hypercode-phase4\\sdks\\vscode; bun install; bun run check-types; bun run package`，然后手工验收 Activity Bar、`hypercode.*`、Session Panel、Sessions / Todo / Modified Files / Subagents |
| 当前 HEAD 状态检查项 | `sdks/vscode/package.json`、`sdks/vscode/README.md`、`sdks/vscode/src`、`sdks/vscode/src/test` | 证据：当前 `HEAD` 状态检查 | 当前状态扫描未发现 `openLicenseFile`、`src/license`、授权阻断或授权测试；这说明 HyperCode 现在维持的是“无 license 门禁的通用版行为” | 这类项作为反回归检查保留；同步或人工合并后重新扫描，命中再人工判断和修复 | 可脚本扫描 | 扫描命中后必须人工判断是否是真问题，不能把零命中硬写成“上游删除记录” | `rg -n "openLicenseFile|src/license|license gate|授权|许可证" sdks/vscode/package.json sdks/vscode/README.md sdks/vscode/src sdks/vscode/src/test` |
| 构建与打包配置 | `packages/opencode/script/build.ts`、`packages/opencode/package.json`、`package.json`、`sdks/vscode/esbuild.js`、`sdks/vscode/tsconfig.json`、`sdks/vscode/.vscodeignore`、`sdks/vscode/script/publish` | 证据：`BASE..HEAD diff` | 真实 diff 显示构建脚本、打包入口、扩展发布脚本和打包忽略规则都已变化 | 同名文件冲突时人工合并；不要整块覆盖，不要只靠文本替换 | 可脚本执行验证，不适合自动合并 | 必须人工确认配置仍符合当前产品形态 | `cd D:\\project\\hypercode-phase4\\sdks\\vscode; bun install; bun run check-types; bun run package` |
| 依赖与 lockfile | `bun.lock`、`sdks/vscode/bun.lock`、`package.json`、`packages/opencode/package.json` | 证据：`BASE..HEAD diff` | 真实 diff 确认 lockfile 和包元数据存在变化，但不能仅靠 diff 推导出更夸张的依赖政策结论 | lockfile 由包管理器再生成；不要手工当作普通 rebrand 文本处理 | 可脚本重装和验证 | 必须人工确认依赖变化是否符合真实构建结果 | `bun install`，然后 `cd D:\\project\\hypercode-phase4\\sdks\\vscode; bun install; bun run check-types; bun run package` |
| 维护文档与辅助脚本 | `docs/*`、`scripts/*`、`scripts/rebrand-opencode-to-hypercode.mjs`、`scripts/sync-opencode-upstream.ps1` | 证据：`BASE..HEAD diff` | 真实 diff 显示已新增维护说明、审计结果和同步辅助脚本，但这些内容本身不是功能差异的替代证据 | 允许随维护流程迭代，但不能替代真实 Git diff、构建验证和功能验收 | 可继续沉淀为脚本 | 必须人工确认文档和脚本仍符合当前流程 | `git diff --name-status 0050134d9eca104b7e38b52b6f0aa62b8c0926db..b4067cf2e7cacfdd2642761dad291ee7ade069f0 -- docs scripts` |

## 6. 可脚本化与人工处理边界

这一节用于回答“哪些工作适合脚本辅助，哪些工作必须保留人工决策”。

### 可以脚本化的内容

- 固定 `BASE..HEAD` 的 diff 统计与文件清单统计
- 品牌残留扫描，例如 `rg -n "opencode|OpenCode|opencode-ai" .`
- 当前 `HEAD` 禁止恢复项扫描，例如 `openLicenseFile`、`src/license`、授权阻断相关关键词
- 扩展公开命令与配置命名扫描，例如 `hypercode.*`、`hypercode.cliPath`、`hypercode.httpProxy`
- 构建命令执行与结果检查，例如 `bun install`、`bun run check-types`、`bun run package`
- VSIX 产物是否生成，以及构建是否报错

### 不应完全自动化的内容

- 同名文件冲突合并
- 产品能力是否保留或取舍的判断
- UI 和交互体验是否符合预期
- README 是否仍然准确表达当前 HyperCode 产品叙事
- 第三方 license、依赖包名、协议文本、历史兼容字段是否应该保留
- lockfile 变化是否真正反映了依赖调整，而不是偶发安装差异
- “构建通过但功能不可用”这类需要打开扩展实际体验才能发现的问题

### 使用原则

- 脚本负责发现问题、统计差异、辅助重放和执行构建
- 人工负责判断差异含义、处理冲突、验收产品行为
- 任何只来自“当前 `HEAD` 状态检查”的结论，都不能改写成“opencode 基线中已确认存在的删除差异”

## 7. 当前已确认的 HyperCode 自定义提交

- Commit: `752a64ee989cdb9897d87b2dfd9b8f2debcdd2f6`
- Subject: `feat(vscode): integrate enhanced HyperCode VS Code extension`

基于 `git show` 和对应 diff，这次提交已确认完成了这些事情：

- `sdks/vscode` 从旧终端入口升级为增强版 HyperCode VS Code 扩展
- 引入 `hypercode.*` 命令体系
- 引入 Activity Bar、Sessions、Todo、Modified Files、Subagents、Session Panel
- 引入 `hypercode.cliPath` 和 `hypercode.httpProxy`
- 引入 workspace runtime 对接
- 当前提交中未发现 `openLicenseFile`、`src/license/*`、授权测试

如果后续同步 upstream 时这些能力在同名文件上发生冲突，应以该提交为回放和人工合并依据。

## 8. 必须保留的 HyperCode 特色

以下内容属于当前 HyperCode 产品层，未来同步 upstream 时必须保留：

- `hypercode.*` 命令体系
- `hypercode.cliPath`
- `hypercode.httpProxy`
- 增强版 VS Code 扩展
- Activity Bar 容器
- Sessions 树
- Todo / Modified Files / Subagents / Session 视图
- Session Webview Panel
- workspace runtime 启动模型
- 无 license 门禁的通用版行为
- `sdks/vscode/README.md` 中完整 HyperCode 集成描述

这些都不允许被 upstream 默认行为覆盖掉。

## 9. 不允许被 upstream 恢复的内容

以下内容是当前 HyperCode 的反回归边界：

- `hypercode.openLicenseFile`
- `src/license/*`
- 启动前 license 授权阻断
- 授权测试
- README 中以旧终端启动器为中心的描述
- 公开入口退回 `opencode.*` 旧命名

这些不是“可选差异”，而是明确禁止恢复的内容。

## 10. 高风险冲突文件

基于真实 diff 和当前已知改动，后续同步 upstream 时应重点人工三方比对这些文件：

- `README.md`
- `package.json`
- `packages/opencode/src/cli/ui.ts`
- `packages/opencode/src/config/config.ts`
- `packages/opencode/src/config/paths.ts`
- `packages/tui/src/feature-plugins/sidebar/footer.tsx`
- `sdks/vscode/package.json`
- `sdks/vscode/README.md`
- `sdks/vscode/esbuild.js`
- `sdks/vscode/tsconfig.json`
- `sdks/vscode/.vscodeignore`
- `sdks/vscode/src/extension.ts`
- `sdks/vscode/src/core/commands.ts`
- `sdks/vscode/src/core/settings.ts`
- `sdks/vscode/src/core/workspace.ts`
- `sdks/vscode/src/core/server.ts`
- `sdks/vscode/src/panel/provider/snapshot.ts`
- `sdks/vscode/bun.lock`

这些文件同时处于品牌层、产品层或构建层交界处，upstream 一旦改到同名文件，必须人工合并。

## 11. 后续同步 opencode 的推荐流程

建议流程如下：

1. 从 HyperCode 当前 `dev` 创建新的 sync 分支
2. `git fetch upstream --prune`
3. 选择固定 upstream commit 或 tag，不只记录浮动的 `upstream/dev`
4. 合并 upstream 目标提交
5. 解决冲突
6. 重新应用或复核 HyperCode rebrand
7. 保留 HyperCode 产品增强层，尤其是 `sdks/vscode`
8. 重点检查高风险冲突文件
9. 执行构建验证
10. 执行 VSIX 手工验收
11. review 通过后再决定是否合入 `dev`

注意：

- 不要直接在 sync 分支发布 release
- 不要把 upstream sync、rebrand、产品增强混成一个不可追溯的大提交

## 12. 同步后的检查命令

### 品牌残留检查

```powershell
rg -n "opencode|OpenCode|opencode-ai" .
```

这个检查会返回大量结果，其中既包括真实残留，也包括第三方依赖名、历史兼容字段和文档示例。需要人工甄别，不能机械全替换。

### license 残留检查

```powershell
rg -n "openLicenseFile|src/license|license gate|授权|许可证" sdks/vscode/package.json sdks/vscode/README.md sdks/vscode/src sdks/vscode/src/test
```

当前状态下，该检查没有命中结果。

### 扩展公开入口检查

```powershell
rg -n "hypercode\.|opencode\.|openLicenseFile" sdks/vscode/package.json sdks/vscode/README.md sdks/vscode/src
```

当前状态下，命中结果集中在 `hypercode.*`、`hypercode.cliPath`、`hypercode.httpProxy` 和扩展内部兼容测试路径。

### 扩展构建验证

```powershell
cd D:\project\hypercode-phase4\sdks\vscode
bun install
bun run check-types
bun run package
```

### VSIX 手工验收清单

- Activity Bar 出现 HyperCode
- `hypercode.*` 命令可用
- `hypercode.quickNewSession` 能打开 Session Panel
- 未配置 CLI 时错误提示指向 `hypercode.cliPath`
- 配置 CLI 后 runtime 可启动
- Sessions / Todo / Modified Files / Subagents 可用
- 不出现 license 授权阻断
- 不出现打开授权文件入口

## 13. 文档边界

这份文档不是自动同步脚本。

它不能：

- 自动合并 upstream
- 自动解决冲突
- 自动完成 rebrand

它的作用是：

- 记录当前 HyperCode 相对固定 opencode 基线的真实差异
- 为后续 upstream sync + rebrand 提供人工维护依据

如果未来要做自动化，应把这里的规则下沉为独立脚本，例如：

- upstream sync 脚本
- rebrand 脚本
- 品牌残留检查脚本
- license 门禁检查脚本
- VS Code 扩展验证脚本
