# Design

## Context

当前 license 采用对称常量 `hyper-aicode-secret-2024`。这个常量同时存在于 CLI、VSCode、签发脚本和打包产物里，任何拿到交付物的人都能签发 license。Windows 机器码用 CPU ProcessorId，同型号 CPU 往往相同。CLI 和 VSCode 各有一套校验实现。规范文档写着“无门禁”，与代码不一致。2026-11-12 的 D1 决策见 `proposal.md`。

## Goals / Non-Goals

**Goals**
- 交付物里不再有任何签发能力；license 无法伪造，也无法通过篡改改出效果。
- 机器码确实对应到一台电脑上的一套系统。
- 只有一个校验实现（CLI）；VSCode 只负责显示和交互。
- 规范、手册和指南统一写成“强制授权，并作为受保护能力”。

**Non-Goals**
- 防时钟回拨、在线吊销、硬件绑定加固（TPM 等）。
- 防二进制补丁绕过：离线客户端无法根本防住，这里只保证 license 本身不能伪造。
- macOS 支持。
- 改变门禁跳过范围或 license 文件路径。

## Decisions

### 1. license v2 格式

`license.txt` 只有一行：

```text
HCL2.<base64url(payload)>.<base64url(signature)>
```

- `payload` 是 UTF-8 JSON，字段为 `{"v":2,"kid":"<密钥标识>","mid":"<机器码指纹>","iat":"YYYY-MM-DD","exp":"YYYY-MM-DD"?,"sub":"<客户标识>"?}`。
- `signature` 是对 `HCL2.<base64url(payload)>` 这段 ASCII 字节做的 Ed25519 签名。
- 验签用 Node/Bun 自带的 `crypto.verify(null, data, publicKey, signature)`，不新增依赖。
- `exp` 表示最后一个有效日（按本地时间，含当天）：当前日期晚于 `exp` 时状态为 `expired`。这一点与现有实现不同：现有实现在到期日当天 00:00 就失效。新格式统一采用“含当天”。
- 识别旧格式：去掉 `-` 和 `|EXP=...` 后长度为 35 或 43、且只含十六进制和数字的内容，判为 `legacy_format`。其余无法解析的内容判为 `malformed`。

考虑过的其他方案：
- JWT/PASETO：要引入依赖，格式也偏重。
- RSA：签名太长，不方便手工复制。
- 在线签发服务：交付场景离线，不适用。

### 2. 公钥与密钥轮换

- 公钥以常量列表的形式放在 `packages/opencode/src/license/public-key.ts`，结构为 `[{ kid, spki }]`（SPKI DER 的 base64）。
- 验签时按 `kid` 选公钥；找不到对应 `kid` 时状态为 `bad_signature`。
- 轮换密钥的做法：在列表里加入新 `kid`，发版，并用新私钥签发。要废弃旧 `kid`，就在后续版本里把它从列表删掉。
- 测试在每次运行时用 `generateKeyPair()` 现场生成测试密钥对，仓库里不存放任何私钥（包括测试私钥）。校验函数接收可注入的 `publicKeys` 参数，测试注入测试公钥；生产代码只使用内置列表，测试断言内置列表不含测试公钥。

### 3. 机器码指纹

- 原始标识：
  - Windows：`reg query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid`。`reg.exe` 是系统自带工具，不依赖已被弃用的 `wmic`，也不依赖 PowerShell 执行策略。输出用正则提取 GUID。
  - Linux：`/etc/machine-id`。
- 指纹：取 `sha256("hypercode-mid-v2:" + platform + ":" + 原始标识小写去空白)` 的前 32 位 hex，按 4 位一组用 `-` 分隔后输出。这样做的效果：
  - 不直接暴露原始 GUID；
  - 带上平台前缀，避免两个平台的标识发生碰撞；
  - 指纹同时写入 payload 的 `mid`，签发工具不需要知道派生规则，直接签输入的指纹即可。
- 风险：没有 sysprep 就克隆的 Windows 镜像，以及 Linux 镜像克隆后没有重新生成 machine-id，都会共享同一标识。这些情况写进用户指南的排错部分：重新生成标识后再申请签发。

### 4. CLI 结构

`packages/opencode/src/license/license.ts` 对外保留以下接口：
- `licensePath`
- `isSupportedPlatform`
- `machineID()`：返回指纹
- `validate({ text, machineID, now, publicKeys })`：返回 `{ status, expires? }`，`status` 的取值为 `valid | missing | empty | read_error | malformed | legacy_format | bad_signature | machine_mismatch | expired | unsupported_platform | machine_id_error`
- `validateFile()`：读取文件后调用 `validate`

同时删除 `secretKey`、`calculateChecksum`、`formatLicense`、`generateExpectedLicense`、`validateLicenseKey`。

`packages/opencode/src/cli/cmd/license.ts`：
- `license status` 加 `--json` 参数，输出 `{"ok":boolean,"status":string,"path":string,"expires":string|null,"message":string|null}` 并以 0 结束（`message` 只在 `read_error`、`machine_id_error` 时携带底层错误原文）；只有 CLI 自身出错时才用非零退出码。不加 `--json` 时保持现有行为：人类可读输出，无效时非零退出。
- 门禁失败文案、`machine-id` 与 `status` 的说明文字，都改用 `cliText` 进行本地化，按 `status` 给出对应的下一步提示（例如 `legacy_format` 提示重新签发）。
- `shouldSkipLicenseGate` 不改。

`main.ts` 中门禁的调用位置不变。新增一个静态回归测试：读取 `src/cli/main.ts` 源码，断言 yargs 全局 `.middleware(...)` 中有 `await enforceLicenseGate(args)` 调用（middleware 在任何子命令 handler 之前执行），并且 `LicenseCommand` 仍被注册。这样做是为了防止 upstream 同步覆盖入口文件时把门禁一并删掉。选择静态检查而不是起子进程测试，是因为固定的 license 路径在开发机上可能真的存在合法 license，子进程测试的结果会不稳定。

### 5. VSCode 改为调用 CLI

- 删除 `licenseAlgorithm.ts`、`machineId.ts`、`licenseValidator.ts`，以及 `licensePaths.ts` 中的路径推导。
- 新增 `licenseStatus.ts`，提供 `queryLicense()`：
  - 复用 `server.ts` 里的 `resolveOpencodeCommand(getCliPath())`、`shouldUseShell` 和环境变量构造逻辑，执行 `<cli> license status --json`，超时 15 秒；
  - 解析 JSON 后返回 `{ ok, status, path, expires }`；
  - 命令无法执行、超时、退出码非 0 或最后一行输出不是合法 JSON 时，返回 `cli_unavailable`，交给现有的 runtime 启动失败流程处理。不允许把这类情况当作授权通过。命令找不到时沿用 runtime 的 "was not found on the current host PATH" 措辞，使现有的“CLI 缺失”提示能识别。
- `workspace.ts` 中的 `deps.validateLicense` 换成 `deps.queryLicense`，失败分支的状态与提示交互保持原样。
- `openLicenseFile`（打开或创建授权文件）使用 JSON 返回的 `path`，不再自己推导路径。
- `localizedLicenseMessage` 只负责把 CLI 返回的状态码映射成 `i18n` 文案。所有状态码都需要中文和英文两套文案。

为什么不放进 `packages/product`：license 失败发生在 TUI 启动之前，TUI 从来不会显示授权状态，所以这不属于 TUI 与 VSCode 的共享产品行为。状态的语义由 CLI `license` 模块定义，VSCode 只负责显示。这也符合 AGENTS.md 的要求：Host 不分别实现错误语义。

VSCode 在启动 `serve` 前先检查一次，是为了给出更友好的提示和交互；`serve` 自己仍会执行门禁，作为第二道防线。两次检查的结果来自同一套实现，不会出现两边判断不一致的漂移。

### 6. 签发工具（保留在内部仓库）

仓库只供内部开发使用，交付给用户的只有 exe 与 vsix，因此签发工具保留在 `packages/opencode/script/license/`（2026-11-12 修订）。安全边界只取决于私钥：

- `script/license/sign.ts`：纯函数 `signLicense(privateKey, { kid, mid, exp?, sub? })` 与 `generateKeyPair()`，供签发 CLI 与测试共用，保证签发格式与验签实现一致。
- `script/license/issue.ts`：签发 CLI，子命令 `keygen`（生成密钥对，私钥写入仓库外路径，输出公钥 SPKI 与 `kid`）、`pubkey` 与 `issue`（`--mid`、`--days` 或 `--exp`、`--sub`、`--out`）。私钥来源优先级：`--key` 指定的文件 > 构建时内置的私钥 > `~/.hypercode-license/signing-key.pem`。`.gitignore` 忽略 `*.pem` 防误提交。每次签发后用产品内置公钥自检，不通过则不输出。
- `script/license/build.ts` 读取私钥，核对其公钥在 `public-key.ts` 中，再用 `bun build --compile --define EMBEDDED_SIGNING_KEY=...` 生成内置私钥的 `dist/HyperCodeLicenseGenerator.exe`，使签发 exe 像旧工具一样拷到任何发证电脑都能用（2026-11-12 维护者决定）。代价是该 exe 等同于私钥，只能内部保管；`dist` 被忽略，交付物边界测试拦截 git 中出现该 exe。删除旧的 `build.ps1` 与旧算法的 `license_generator.py`、`licenseGenerator.cjs`、`test_license_generator.py`、`requirements-build.txt`。
- 签发工具不被任何产品入口导入，不进入 exe/vsix；交付物扫描测试确认这一点。
- git 历史中仍保留旧常量。由于新版本已经不接受旧格式，这份历史不构成可用的签发能力，因此不重写历史。

### 7. 规范与文档

- `docs/规范/上游同步与品牌化规范.md`：
  - 删除“无 license 门禁的通用版行为”；
  - 把“禁止恢复项”中与 license 相关的 4 条移到“受保护能力”，表述为“不得被 upstream 或重构移除”；
  - 在同步验收清单中加入两项检查：无 license 时被阻止、有效 license 时正常启动。
- `docs/操作手册/构建与交付规范.md` L84：改为确认无 license 时出现中文授权提示、有效 license 时正常进入首页；另外加一条交付物检查：不含签发工具和私钥。
- `docs/hypercode 相对 OpenCode 的特色改动总览.md` §5：改写为“授权门禁（受保护能力）”，引用 `openspec/specs/license-gate`。
- 用户指南需要更新以下内容：
  - 机器码说明，Windows 改为系统标识，不再使用 CPU；
  - 签发工具名称，指向新工具；
  - 升级时需要重新签发；
  - 旧格式报错的含义；
  - macOS 不在支持范围；
  - 克隆镜像的排错方法。

## Risks / Trade-offs

- **重签发窗口**：直接切换意味着客户升级后，在拿到新 license 之前无法使用。缓解办法：发版说明先行，并给出流程——客户先安装新版本，执行 `license machine-id`（这个命令不受门禁约束），把输出交给管理员签发，再导入 license。管理员在发版前完成全部签发。
- **私钥丢失或泄露**：丢失后无法再签发，泄露后可以伪造 license。缓解办法：私钥离线备份两份；用 `kid` 轮换机制发新版本、废弃泄露的 `kid`。私钥或内置私钥的签发 exe 误提交到 git、外传，均视同泄露。
- **克隆镜像共享 MachineGuid**：一份 license 可以在克隆出来的机器上通过校验。这种情况属于部署规范问题，在指南中要求克隆后执行 sysprep 或重新生成 machine-id。
- **二进制补丁绕过**：无法在离线条件下防住，不在本 change 范围内。
- **upstream 同步冲突**：`main.ts` 中的门禁调用只有一行，冲突成本很低；有静态回归测试兜底。

## Migration Plan

1. 用新签发工具生成生产密钥对（私钥留在仓库外），把公钥写入 `public-key.ts`。
2. 实现 CLI 和 VSCode 的改动，完成测试，更新文档。
3. 发版前：通知客户，收集新的机器码指纹，批量签发 v2 license。
4. 发版：离线包中附带重签说明，客户先导入新 license，再开始使用。
5. 回滚：如果新版本有严重问题，客户退回旧版本并继续使用旧 license（旧版本仍接受旧格式），所以回滚期间不需要再签发。

## Open Questions

- 生产私钥由谁保管、备份在哪里：由维护者确定，不影响产品代码。
