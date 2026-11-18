# Tasks

## 1. 签发工具与密钥

- [x] 1.1 新增 `packages/opencode/script/license/sign.ts`（`generateKeyPair`、`signLicense`）与 `issue.ts`（`keygen`、`issue` 子命令，私钥默认 `~/.hypercode-license/signing-key.pem`）
- [x] 1.2 `build.ts` 用 `bun build --compile` 生成内置私钥的 `HyperCodeLicenseGenerator.exe`（构建前核对公钥匹配）；删除 `build.ps1` 与旧算法的 Python/Node 工具及其测试；`.gitignore` 忽略 `*.pem`
- [x] 1.3 生成生产密钥对，私钥留在仓库外，导出公钥 SPKI 与 `kid`；维护者确定私钥保管人与备份位置（2026-11-12 已在开发机生成 `kid 5e8098b097d0`，私钥位于 `~/.hypercode-license/signing-key.pem`，公钥已写入产品；待维护者确认保管人、离线备份，或另行生成后替换）
  - 维护者决定（2026-11-18）：私钥由维护者本人保管，继续放在开发机 `~/.hypercode-license/signing-key.pem`（仓库外）；不另做离线备份，不另行生成
- [x] 1.4 重写 `script/license/README.md`：密钥生成、签发、保管与轮换说明

## 2. CLI 校验实现

- [x] 2.1 新增 `packages/opencode/src/license/public-key.ts`（`[{ kid, spki }]`），只包含生产公钥
- [x] 2.2 重写 `packages/opencode/src/license/license.ts`：Windows 机器码通过 `reg query` 读取 MachineGuid，Linux 读取 `/etc/machine-id`，派生规则为 `hypercode-mid-v2` 指纹；`validate` 负责 v2 解析和 Ed25519 验签，输出 design 中定义的全部状态码，`exp` 按含当天计算；识别旧格式时返回 `legacy_format`；删除 `secretKey` 与旧算法函数
- [x] 2.3 修改 `packages/opencode/src/cli/cmd/license.ts`：`status` 增加 `--json`；门禁、`machine-id` 与 `status` 的文案按状态码给出本地化的下一步提示（走 `cliText`）；非 Windows/Linux 平台统一提示“该平台不在交付范围”；不修改 `shouldSkipLicenseGate`
- [x] 2.4 改写 `packages/opencode/test/license/license.test.ts`，用每次运行现场生成的测试密钥对覆盖以下情况：有效、篡改载荷、未知 `kid`、机器码不匹配、过期边界（到期日当天有效、次日失效）、旧格式、格式错误、空文件、缺失文件、MachineGuid 输出解析、指纹派生
- [x] 2.5 扩展 `license-gate.test.ts`：跳过列表保持不变（`serve`/`run`/`mcp`/`auth` 受约束），并加静态断言：`src/cli/main.ts` 在 yargs 解析前调用 `await enforceLicenseGate(`
- [x] 2.6 增加交付物扫描测试或脚本：仓库源码和构建产物中不出现 `hyper-aicode-secret-2024` 或任何私钥 PEM
- [x] 2.7 在 `packages/opencode` 运行 license 相关测试和 `bun typecheck`

## 3. VSCode 改为调用 CLI

- [x] 3.1 新增 `sdks/vscode/src/license/licenseStatus.ts` 的 `queryLicense()`：复用 `resolveOpencodeCommand(getCliPath())` 和 `shouldUseShell` 执行 `license status --json`，超时 15 秒；命令不可执行、超时或输出非法时返回 `cli_unavailable`
- [x] 3.2 删除 `licenseAlgorithm.ts`、`machineId.ts`、`licenseValidator.ts` 以及 `licensePaths.ts` 中的路径推导；`openLicenseFile` 改用 CLI 返回的 `path`
- [x] 3.3 `workspace.ts` 改用 `deps.queryLicense`：失败时把工作区标记为错误、不启动 `serve`，保留打开、创建、重试三个操作；`cli_unavailable` 走 runtime 启动失败提示
- [x] 3.4 在 `sdks/vscode/src/i18n/{zh,en}.ts` 中为全部状态码补齐文案（含 `legacy_format`、`unsupported_platform`、`machine_mismatch`、`bad_signature`）
- [x] 3.5 改写 `sdks/vscode/src/test/license.test.ts`：注入 `queryLicense` 覆盖有效、各类无效、`cli_unavailable`，并验证中文提示与工作区状态；在 `sdks/vscode` 运行测试与 typecheck

## 4. 交付物边界

- [x] 4.1 确认签发工具不被任何产品入口导入，exe/vsix 中不含签发代码与私钥（2.6 的扫描覆盖）
- [x] 4.2 核对 `offline-package.ts` 的 `install-license.sh` 与 `offline-windows-package.ts` 的路径和提示文案仍然正确

## 5. 规范与文档

- [x] 5.1 `docs/规范/上游同步与品牌化规范.md`：删除“无 license 门禁的通用版行为”；把 4 项 license 条目从“禁止恢复项”移到“受保护能力”；同步验收加入“无 license 被阻止、有效 license 正常启动”
- [x] 5.2 `docs/操作手册/构建与交付规范.md`：L84 改为确认中文授权提示和有效 license 时正常进入；增加交付物不含签发工具和私钥的检查
- [x] 5.3 `docs/hypercode 相对 OpenCode 的特色改动总览.md` §5：改写为“授权门禁（受保护能力）”并引用 `openspec/specs/license-gate`
- [x] 5.4 用户指南（安装部署说明、Ubuntu 离线指南、使用说明书、功能总览）：更新机器码说明、签发工具名、升级需重签、旧格式报错含义、macOS 不支持、克隆镜像排错
- [x] 5.5 编写面向管理员的重签发流程（见 `packages/opencode/script/license/README.md`“签发流程”“旧格式”）：客户安装新版本，运行 `license machine-id` 并提交，管理员批量签发，客户导入，`license status` 验证

## 6. 发版与验收

- [ ] 6.1 在 Windows 与 Linux 实机验证：无 license 被阻止；旧 license 提示 `legacy_format`；新 license 正常；篡改或换机失败；VSCode 显示中文提示，修复后可重试
  - 2026-11-18 Windows CLI 部分已自动验证（EXE `d4ae9413…`）：缺失、旧格式、空文件、乱码、篡改、机器码不符（用伪造机器码签发模拟）均以退出码 1 拒绝，并显示对应的中文原因；`--version`、`license machine-id` 不受影响；本机新签 License 有效，可以正常执行。签发工具拒绝签发已过期日期，过期判定由 `test/license` 覆盖
  - 同时发现并修复签发工具泄露私钥：Bun 默认的崩溃报告会打印出错位置附近的打包源码，而 `--define` 内联的私钥就在 `parseArgs` 旁边，`--help` 或任何错误参数都会把私钥打印到终端。`script/license/issue.ts` 现在注册了 `uncaughtException`/`unhandledRejection` 处理，只输出错误信息；重建后错误参数、写文件失败的输出中均不含私钥。`--help` 改为显示用法
  - 维护者决定（2026-11-18）：不轮换密钥，不清理会话记录。理由：签发 exe 本身明文内置私钥，持有 exe 即等同持有私钥，这次泄露没有超出原有的风险边界
  - 待用户手测：Linux 实机全部场景、VSCode 中文提示与重试
- [ ] 6.2 在两台同型号 CPU 的 Windows 电脑上确认机器码不同
- [ ] 6.3 在 macOS 上（如有条件）确认提示“该平台不在交付范围”
- [ ] 6.4 发版前完成全部客户的 v2 license 签发，并在发版说明中写明直接切换与重签流程
- [ ] 6.5 归档本 change，把 `license-gate` 同步到 `openspec/specs/`
