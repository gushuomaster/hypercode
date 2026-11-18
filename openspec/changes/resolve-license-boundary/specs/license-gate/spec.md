# Spec Delta

## Purpose

规定 hypercode 交付版授权门禁的强制范围、license 格式与验签方式、机器码来源、支持平台、CLI 与 VSCode 的实现归属，以及授权门禁作为受保护 hypercode 能力在 upstream 同步与重构中的地位。

## ADDED Requirements

### Requirement: 交付版强制授权

hypercode 交付版 SHALL 在执行受门禁约束的命令前校验 license，且不存在无门禁的交付形态。校验失败时 CLI MUST 向 stderr 输出本地化的失败原因、license 文件路径与下一步操作提示，并以非零退出码结束，不得进入 TUI、启动 server 或执行模型调用。

#### Scenario: 缺少 license 时启动 TUI
- **WHEN** 目标机没有 license 文件，用户执行 `hypercode`
- **THEN** CLI MUST 以非零退出码结束，提示 license 文件缺失、应放置的路径，以及用 `hypercode license machine-id` 申请签发

#### Scenario: license 有效
- **WHEN** license 验签通过、机器码匹配且未过期
- **THEN** 命令 MUST 正常执行，不输出任何授权提示

### Requirement: 门禁跳过范围固定

只有以下情形 SHALL 跳过门禁：`license` 子命令、`help` 与 `completion` 子命令、带 `--help`/`-h`/`--version`/`-v` 的调用、`generate` 命令，以及测试执行环境（`NODE_ENV=test` 或设置 `OPENCODE_TEST_HOME`）。其余命令，包括 `serve`、`run`、`mcp`、`auth`，MUST 受门禁约束。扩大跳过范围 MUST 经维护者决策并更新本 spec。

#### Scenario: 无 license 时查询机器码
- **WHEN** 目标机没有 license，用户执行 `hypercode license machine-id`
- **THEN** CLI MUST 输出本机机器码并以零退出码结束

#### Scenario: serve 受约束
- **WHEN** 目标机 license 无效，执行 `hypercode serve`
- **THEN** CLI MUST 以非零退出码结束，不得监听端口

### Requirement: license 采用非对称签名

license SHALL 为带版本号的签名格式：载荷至少包含格式版本、签名密钥标识、机器码，以及可选的到期日，签名算法为 Ed25519。产品 MUST 只内置验签公钥，MUST NOT 包含任何可用于生成有效 license 的私钥或共享密钥。签发工具 MAY 保留在内部开发仓库，但 MUST NOT 进入交付物；签发私钥 MUST NOT 进入 git 仓库与任何交付物。

#### Scenario: 篡改载荷
- **WHEN** 用户修改 license 载荷中的机器码或到期日
- **THEN** 验签 MUST 失败，状态为签名无效

#### Scenario: 交付物不含签发能力
- **WHEN** 检查 `hypercode.exe`、离线包与 `hypercode.vsix`
- **THEN** MUST NOT 找到签发私钥、旧共享密钥常量或签发工具；git 仓库中 MUST NOT 出现生产私钥

### Requirement: 旧格式 license 直接失效

实现新格式后，产品 SHALL 只接受新格式 license，不提供旧格式兼容或过渡期。识别为旧格式的 license MUST 报告专门的“旧格式已停用”状态并提示联系管理员重新签发，而不是笼统地报告无效。

#### Scenario: 升级后使用旧 license
- **WHEN** 客户升级到新版本，license 文件仍是旧格式
- **THEN** 门禁 MUST 阻止执行，并提示旧格式已停用、需要用 `hypercode license machine-id` 的新输出重新申请签发

### Requirement: 机器码来源

Windows 机器码 SHALL 读取注册表 `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`，Linux 机器码 SHALL 读取 `/etc/machine-id`。`license machine-id` 输出的是由平台与原始标识派生的规范化指纹，签发与校验 MUST 使用同一派生规则。读取失败时 MUST 报告本地化错误，不得回退到其他硬件标识。

#### Scenario: 同型号 CPU 的两台 Windows 电脑
- **WHEN** 两台安装独立系统、CPU 型号相同的 Windows 电脑分别执行 `hypercode license machine-id`
- **THEN** 两者输出 MUST 不同，为其中一台签发的 license 在另一台 MUST 校验失败

#### Scenario: 原始标识不可读
- **WHEN** Linux 上 `/etc/machine-id` 不存在或为空
- **THEN** `license machine-id` 与门禁 MUST 报告无法读取机器码并以非零退出码结束

### Requirement: 支持平台范围

授权门禁与交付范围 SHALL 只包含 Windows 与 Linux。在其他平台（包括 macOS）上，`license machine-id`、`license status` 与门禁 MUST 报告“该平台不在交付范围”的本地化提示并以非零退出码结束。

#### Scenario: macOS 上运行
- **WHEN** 在 macOS 上执行 `hypercode` 或 `hypercode license status`
- **THEN** CLI MUST 以非零退出码结束，提示该平台不在交付范围、支持 Windows 与 Linux

### Requirement: CLI 是唯一校验实现

license 解析、验签、机器码读取、路径推导与状态判定 SHALL 只在 CLI 中实现。`hypercode license status --json` MUST 输出稳定的结构化结果（是否有效、状态码、license 路径、到期日）。VSCode MUST 通过调用该命令获取授权状态并按状态码显示本地化提示，MUST NOT 自行实现校验算法、机器码读取或路径推导。

#### Scenario: VSCode 启动时 license 无效
- **WHEN** VSCode 为工作区启动 runtime，`license status --json` 返回无效
- **THEN** VSCode MUST 将该工作区标记为错误、不启动 `hypercode serve`，并显示含打开授权文件与重试操作的中文提示

#### Scenario: CLI 不可执行
- **WHEN** VSCode 无法执行配置的 CLI 或输出不是合法 JSON
- **THEN** VSCode MUST 按 runtime 启动失败处理并显示 CLI 不可用的提示，MUST NOT 判定为授权通过

### Requirement: 授权门禁是受保护能力

授权门禁 SHALL 是受保护的 hypercode 能力：upstream 同步、fork 瘦身与重构 MUST NOT 移除 CLI 入口的门禁调用、`license` 子命令、VSCode 授权提示与 `hypercode.openLicenseFile` 命令。同步验收 MUST 确认无 license 时门禁生效、有效 license 时正常启动，并有自动化测试防止门禁调用从 CLI 入口消失。

#### Scenario: upstream 同步改写 CLI 入口
- **WHEN** 同步后的 `packages/opencode/src/cli/main.ts` 不再调用门禁
- **THEN** 回归测试 MUST 失败，同步 MUST NOT 合入
