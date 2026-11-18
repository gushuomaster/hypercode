# HyperCode License 签发工具（内部）

发证管理员使用的签发工具。工具代码可以留在内部开发仓库，但**不能**分发给客户，也不能进入 `hypercode.exe`、离线包或 `hypercode.vsix`。客户只拿到最终生成的 `license.txt`。

规格见 `openspec/changes/resolve-license-boundary/`（归档后为 `openspec/specs/license-gate/spec.md`）。

## 安全边界

- License 使用 Ed25519 非对称签名。产品里只有公钥（`packages/opencode/src/license/public-key.ts`），拿到产品的人无法签发 license。
- **私钥是唯一的秘密**。源文件默认在 `~/.hypercode-license/signing-key.pem`（仓库之外），`.gitignore` 已忽略 `*.pem`。请离线备份两份。
- **构建出的 `HyperCodeLicenseGenerator.exe` 内置了私钥**，拷到任何电脑都能直接签发，因此 exe 本身和私钥一样需要保密：只在内部保管，不发给客户，不提交到 git（`dist` 已被忽略，测试也会拦截）。
- 私钥丢失后无法继续签发；私钥或签发 exe 泄露后任何人都能签发。两种情况都按下面的“密钥轮换”处理。

## 构建

需要 Bun。在 `packages/opencode` 目录执行：

```powershell
bun script/license/build.ts            # 默认读取 ~/.hypercode-license/signing-key.pem
bun script/license/build.ts --key D:\keys\signing-key.pem
```

产物为 `packages/opencode/script/license/dist/HyperCodeLicenseGenerator.exe`。构建时会核对私钥与产品内置公钥是否匹配，不匹配就拒绝构建。之后只需要把这个 exe 拷到发证电脑上使用，不用再带私钥文件。

在有私钥文件的电脑上，也可以不构建，直接运行 `bun script/license/issue.ts <子命令>`，参数完全相同。

## 签发流程

1. 客户在目标机执行 `hypercode license machine-id`（不需要授权即可运行），把输出交给管理员。
   输出形如 `5da1-32fc-0f7b-afcb-4c94-5361-4d2c-eb4a`：Windows 由系统 MachineGuid 派生，Linux 由 `/etc/machine-id` 派生。
2. 管理员签发：

   ```powershell
   # 永久
   HyperCodeLicenseGenerator.exe issue --mid 5da1-32fc-0f7b-afcb-4c94-5361-4d2c-eb4a --sub 客户名 --out license.txt
   # 30 天（含今天）
   HyperCodeLicenseGenerator.exe issue --mid <机器码> --days 30 --sub 客户名 --out license.txt
   # 指定最后有效日（含当天）
   HyperCodeLicenseGenerator.exe issue --mid <机器码> --exp 2027-06-30 --sub 客户名 --out license.txt
   ```

   每次签发都会先用产品内置公钥自检，确认无误才输出；签出的 license 一定能被当前版本接受。
3. 客户把 `license.txt` 放到 `hypercode license path` 输出的位置（Linux 可用离线包的 `install-license.sh`），然后执行 `hypercode license status` 验证。

## 首次生成密钥与密钥轮换

```powershell
HyperCodeLicenseGenerator.exe keygen            # 生成新私钥，并打印要写入 public-key.ts 的公钥行
HyperCodeLicenseGenerator.exe pubkey            # 根据现有私钥重新打印公钥行
```

`keygen` 不会覆盖已有私钥；确需覆盖时，加 `--force` 并指定新路径。

轮换步骤：

1. 生成新私钥（用新的 `--key` 路径）。
2. 把新公钥行**追加**到 `public-key.ts`，然后发版。
3. 用 `bun script/license/build.ts --key <新私钥>` 重新构建签发 exe，销毁旧 exe，之后用新 exe 签发。
4. 要让旧 key 签发的 license 失效，在后续版本中从 `public-key.ts` 删除旧 `kid`，并为受影响的客户重新签发。

## 旧格式

2026-11 之前签发的 `sha256(机器码-共享密钥)` 格式 license 已停用。新版本会把它识别为“旧格式已停用”，客户需要用新版本的 `license machine-id` 输出重新申请签发。

开发机同样需要新格式 license 才能在非测试环境下运行 CLI；测试环境（`NODE_ENV=test`）会跳过门禁。
