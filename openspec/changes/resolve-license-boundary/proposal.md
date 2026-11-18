# Proposal（草案：D1 对齐中）

> 2026-11-12 决策 D1 = **A：交付版强制授权，授权门禁是受保护的 HyperCode 能力**。其余细节问题对齐后补齐 specs / design / tasks。

## Why

HyperCode 对 license 门禁的规定在规范、代码与用户文档之间相互矛盾，upstream 同步与日常维护无法判断"出现 license 门禁"是回退信号还是预期行为：

| 来源 | 说法 |
| --- | --- |
| `docs/规范/上游同步与品牌化规范.md` L54、L63-66 | 必须保留"无 license 门禁的通用版行为"；`hypercode.openLicenseFile`、`src/license/*`、启动前授权阻断、授权测试列为**禁止恢复项** |
| `docs/操作手册/构建与交付规范.md` L84 | 验收时确认"没有出现 license 授权阻断" |
| `docs/HyperCode 相对 OpenCode 的特色改动总览.md` §5 | 标题已改为"license 边界与保留项"，措辞模糊：既说不把门禁作为公开面，又说不能假设仓库已无授权入口 |
| `docs/用户指南/*`（安装部署说明、Ubuntu 离线指南） | License 是交付必需步骤：`hypercode license machine-id/status/path`、`install-license.sh`、`HyperCodeLicenseGenerator.exe` 签发 |
| 代码 | **默认强制**：CLI 启动调用 `enforceLicenseGate`（`packages/opencode/src/cli/main.ts:76`），失败 `process.exit(1)`；VSCode 启动 workspace server 前校验（`sdks/vscode/src/core/workspace.ts:158`） |

## 已核实的事实

**时间线**
- 2026-06-20 `98d6028bb` 迁入"机器码强授权系统（默认关闭）"。
- 2026-07-02 规范文档重写（standards-docs），写入"无 license 门禁、禁止恢复"。
- 2026-07-03 `9aa499206` "enforce license checks by default"，`3cfac83a8` 为测试与 generate 跳过门禁。同日的特色改动总览把第 5 节改为"license 边界与保留项"。
- 2026-07-09 `951708526` 增加 Windows license 回退与客户指南。
- 推断：规范是在"默认强制"决策前一天写的，之后没有同步更新。

**当前实现**
- CLI 跳过门禁的情形：`--help`/`-h`/`--version`/`-v`、`help`、`completion`、`license` 子命令、build/generate 命令、测试环境（`shouldSkipLicenseGate`）。
- 校验算法：`sha256(机器码-secretKey[-到期日])` 取前 32 位 hex，加 3 位字符和校验，可选 8 位到期日；`secretKey` 为常量 `hyper-aicode-secret-2024`，明文写在 CLI（`packages/opencode/src/license/license.ts:6`）、VSCode（`sdks/vscode/src/license/licenseAlgorithm.ts:5`）以及打包后的二进制中。
- 签发工具也已入库：`packages/opencode/script/license/licenseGenerator.cjs`、`license_generator.py`（含同一常量）。任何能访问仓库、exe 或 vsix 的人都能为任意机器生成有效 license。
- 机器码：Windows 取 **CPU ProcessorId**（依次尝试 `wmic`、`powershell`、`pwsh`），Linux 取 `/etc/machine-id`；macOS 不支持。ProcessorId 只标识 CPU 型号/步进，同型号 CPU 的不同电脑通常相同，因此 Windows 上一份 license 往往可在同型号 CPU 的所有电脑上通过。
- 重复校验：VSCode 启动 `hypercode serve` 前先自行校验；而 `serve` 不在 CLI 跳过列表中，CLI 也会再校验一次。
- License 路径：Windows 为固定绝对路径，Linux 为 `~/hyper-aicode/license.txt`。
- 两套实现：CLI（`packages/opencode/src/license/license.ts` + `src/cli/cmd/license.ts`）与 VSCode（`sdks/vscode/src/license/*` 共 6 个文件）各自实现校验逻辑；VSCode 提供 `hypercode.openLicenseFile` 命令。
- 测试：`packages/opencode/test/license/{license,license-gate}.test.ts`、`sdks/vscode/src/test/license.test.ts`。
- 交付：Ubuntu 离线包含 `install-license.sh`；Windows 离线包写入 license 路径。

## 决策（2026-11-12）

| # | 问题 | 结论 |
| --- | --- | --- |
| 1 | 产品定位 | **A**：交付版强制授权，不存在无门禁交付形态。授权门禁是受保护的 hypercode 能力，upstream 同步或重构不得移除 |
| 2 | 防伪强度 | 改用**非对称签名**：产品只内置公钥；签发工具保留在内部开发仓库（不进入 exe/vsix），签发私钥不进入 git 与任何交付物（2026-11-12 修订：仓库仅内部使用，工具无需迁出） |
| 3 | 机器码 | Windows 改用注册表 `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`；Linux 继续用 `/etc/machine-id` |
| 4 | 实现归属 | CLI 是唯一校验实现；VSCode 删除自有算法，改为调用 `hypercode license status --json` 并按结果显示中文提示 |
| 5 | 旧 license | **直接切换**：新版本只接受新格式，旧格式一律无效；发版前为所有客户重新签发，不设过渡期 |
| 6 | 门禁范围 | 维持现状：跳过列表不变，`serve`、`run`、`mcp`、`auth` 等其余命令均受门禁约束；VSCode 校验失败时提示并阻止启动 workspace runtime |
| 7 | 平台范围 | 明确**不支持 macOS**：给出“该平台不在交付范围”的清晰提示，并写入规范 |

## What Changes

- **BREAKING** license 格式改为带签名的 v2 格式（Ed25519），旧的 `sha256(机器码-常量)` 格式全部失效。
- **BREAKING** Windows 机器码来源由 CPU ProcessorId 改为 MachineGuid，`license machine-id` 输出改变，所有客户需重新获取机器码并重新签发。
- CLI `license` 模块改为公钥验签；删除 `secretKey` 常量；新增 `license status --json` 结构化输出；门禁与 `license` 子命令的用户可见文案按 CLI 界面语言本地化。
- VSCode 删除 `sdks/vscode/src/license` 中的算法、机器码与路径推导，改为调用 CLI；保留 `hypercode.openLicenseFile` 与失败提示交互。
- 签发工具（`packages/opencode/script/license/`）在仓库内改写为 Ed25519 签发（Bun 脚本，可编译为 `HyperCodeLicenseGenerator.exe`），替换旧的 Python GUI 与 `licenseGenerator.cjs`；生产私钥保存在仓库外，仓库内只有公钥与测试用密钥对。
- 修正与“强制授权”矛盾的规范、构建手册、特色总览，并把授权门禁列为受保护能力与 upstream 同步检查项；更新用户指南中的机器码、签发与重签说明。

## Capabilities

### New Capabilities

- `license-gate`：交付版授权门禁的强制范围、license 格式与验签、机器码来源、平台范围、CLI 单一实现与宿主调用方式、受保护地位。

### Modified Capabilities

（无）

## Impact

- 代码：`packages/opencode/src/license/license.ts`、`packages/opencode/src/cli/cmd/license.ts`、`packages/opencode/src/cli/main.ts`（只核对门禁调用位置）、`sdks/vscode/src/license/*`、`sdks/vscode/src/core/{workspace.ts,commands.ts}`、`sdks/vscode/src/i18n/{zh,en}.ts`。
- 测试：`packages/opencode/test/license/{license,license-gate}.test.ts`、`sdks/vscode/src/test/license.test.ts`。
- 打包：`packages/opencode/script/offline-package.ts`（`install-license.sh`）、`offline-windows-package.ts`（文件路径不变，仅核对提示文案）。
- 仓库结构：`packages/opencode/script/license/` 改写，删除旧算法的 Python/Node 工具。
- 文档：`docs/规范/上游同步与品牌化规范.md`、`docs/操作手册/构建与交付规范.md`、`docs/hypercode 相对 OpenCode 的特色改动总览.md`、`docs/用户指南/{安装部署说明,Ubuntu20.04离线安装与配置,使用说明书,OpenCode与HyperCode功能总览}.md`。
- 交付：发版前必须完成全部客户的重新签发；已签发的旧 license 在升级后立即失效。
- 已知风险：未经 sysprep 克隆的 Windows 镜像共享 MachineGuid；旧密钥仍留在 git 历史中，但新版本不再接受旧格式，因此不构成可利用的签发能力；私钥若误入 git 等同泄露，需要轮换 `kid`。
