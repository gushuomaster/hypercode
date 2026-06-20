# HyperCode License 签发工具

这是 **发证机(你自己掌握的机器)** 上使用的 license 签发工具,**不分发给目标机**。
目标机只需要最终的 `license.txt`。

## 算法一致性(重要)

签发与验证共用同一套算法,分布在三处,**改任意一处都必须三处同步**:

- 签发:`packages/opencode/script/license/licenseGenerator.cjs`(本文件)
- CLI 验证:`packages/opencode/src/license/license.ts`
- 扩展验证:`sdks/vscode/src/license/licenseAlgorithm.ts`

共享密钥 `secretKey = "hyper-aicode-secret-2024"`。注意它进仓库后即半公开;
若要真正的商业防护,应改为构建期注入而非硬编码。

## 网关默认关闭

CLI 与扩展的启动网关默认 **不** 强制校验,仅当环境变量 `HYPERCODE_LICENSE_ENFORCE=1`
时生效。日常开发无需 license;分发构建时设置该变量即开启机器码强校验。

## 签发流程

### 1. 目标机获取机器码

```bash
hypercode license machine-id
# 或在未加入 PATH 时:
wmic cpu get processorid        # Windows
cat /etc/machine-id             # Linux
```

把机器码发回发证机。

### 2. 发证机签发

永久 license(把 `TARGET_MACHINE_ID` 换成对方机器码):

```bash
node -e "const {LicenseGenerator}=require('./licenseGenerator.cjs');const g=new LicenseGenerator();console.log(g.generateLicense('TARGET_MACHINE_ID'));"
```

时效 license(可选 `half-month` / `one-month` / `three-months`):

```bash
node -e "const {LicenseGenerator}=require('./licenseGenerator.cjs');const g=new LicenseGenerator();console.log(g.generateTimedLicense('TARGET_MACHINE_ID','one-month'));"
```

### 3. 写回目标机

把生成的字符串写入目标机对应平台的 `license.txt`:

- Windows: `C:\hyper-aicode\license.txt`
- 非 Windows: `~/hyper-aicode/license.txt`

### 4. 目标机验证

```bash
hypercode license status
# 返回 "HyperCode license is valid." 即成功
```
