# HyperCode License 签发工具

这是发证管理员在受控 Windows 机器上使用的 License 签发工具，不能分发给客户或目标机器。目标机器只需要最终生成的 `license.txt`。

推荐使用 Python GUI 构建的 `HyperCodeLicenseGenerator.exe`。原有 `licenseGenerator.cjs` 继续保留，用于兼容和算法核对。

## 安全边界

签发工具包含共享密钥 `secretKey = "hyper-aicode-secret-2024"`。EXE 虽然隐藏了源代码入口，但仍可能被逆向分析，因此只能由发证管理员保管，不能作为客户交付物。

当前共享密钥已经进入仓库，属于半公开方案。如果需要真正的商业防护，应迁移到受控服务端签发或采用非对称签名，而不是继续把签发密钥放进客户端或离线工具。

## 推荐方式：Python GUI

### 1. 构建 EXE

需要 Windows 和 Python 3.13。首次构建会在 `.artifacts` 中创建隔离环境，并安装固定版本的 PyInstaller。

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\packages\opencode\script\license\build.ps1
```

构建产物位于：

```text
packages\opencode\script\license\dist\HyperCodeLicenseGenerator.exe
```

`.artifacts` 和 `dist` 都是本地构建目录，不应提交仓库。

### 2. 获取目标机器 ID

在目标机器执行：

```powershell
hypercode license machine-id
```

把输出的机器 ID 发给发证管理员。

### 3. 图形界面签发

双击运行 `HyperCodeLicenseGenerator.exe`：

1. 输入目标机器 ID。
2. 选择“永久”“15 天”“30 天”或“90 天”。
3. 点击“生成 License”。
4. 复制 License 字符串，或者保存为 `license.txt`。

修改机器 ID 或授权期限后，旧结果会自动失效，必须重新生成。

### 4. 写回并验证

把生成的字符串写入目标机器对应平台的文件：

- Windows：`C:\hyper-aicode\license.txt`
- Linux：`~/hyper-aicode/license.txt`

文件中只能包含最终 License 字符串，不要附加说明文字。随后执行：

```powershell
hypercode license status
hypercode license path
```

返回 `HyperCode license is valid.` 即表示授权成功。

## 兼容方式：Node.js

如果发证机暂时不能构建 Python EXE，可以在 `packages/opencode/script/license` 目录继续使用原有脚本。

永久 License：

```powershell
node -e "const {LicenseGenerator}=require('./licenseGenerator.cjs');const g=new LicenseGenerator();console.log(g.generateLicense('TARGET_MACHINE_ID'));"
```

时效 License，可选 `half-month`、`one-month` 或 `three-months`：

```powershell
node -e "const {LicenseGenerator}=require('./licenseGenerator.cjs');const g=new LicenseGenerator();console.log(g.generateTimedLicense('TARGET_MACHINE_ID','one-month'));"
```

## 算法一致性

签发与验证共用同一套算法，分布在四处。修改任意一处时，必须同步修改并运行兼容性测试：

- Python GUI：`packages/opencode/script/license/license_generator.py`
- Node.js 兼容工具：`packages/opencode/script/license/licenseGenerator.cjs`
- CLI 验证：`packages/opencode/src/license/license.ts`
- VS Code 扩展验证：`sdks/vscode/src/license/licenseAlgorithm.ts`

CLI 与扩展启动时会校验 `license.txt` 是否存在、非空、未过期且与当前机器 ID 匹配。日常开发机器也需要准备有效 License，确保开发环境与交付版本行为一致。
