import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"

interface ArchiveEntry {
  name: string
  source?: string
  content?: string
}

export async function createOfflineWindowsPackage(input: {
  version: string
  outputDir: string
  standardBinary: string
  baselineBinary: string
  extension: string
  vscodeInstaller?: string
  gitInstaller?: string
}) {
  const root = `hypercode-offline-windows-x64-${input.version}`
  const archive = path.join(input.outputDir, `${root}.zip`)
  const entries: ArchiveEntry[] = [
    { name: "bin/standard/hypercode.exe", source: input.standardBinary },
    { name: "bin/baseline/hypercode.exe", source: input.baselineBinary },
    { name: "extension/hypercode.vsix", source: input.extension },
    { name: "config/minimax-direct.json", content: minimaxConfig },
    { name: "config/internal-openai-compatible.json.example", content: internalConfig },
    { name: "install.ps1", content: installScript },
    { name: "install.cmd", content: installCommand },
    { name: "README.zh-CN.md", content: readme(input.version) },
    ...(input.vscodeInstaller ? [{ name: "installers/VSCodeSetup.exe", source: input.vscodeInstaller }] : []),
    ...(input.gitInstaller ? [{ name: "installers/GitSetup.exe", source: input.gitInstaller }] : []),
  ]
  const checksums = await Promise.all(
    entries.map(async (entry) => `${await hashEntry(entry)}  ${entry.name.replaceAll("\\", "/")}`),
  )
  entries.push({ name: "SHA256SUMS.txt", content: `${checksums.join("\n")}\n` })

  const writer = new ZipWriter(new Uint8ArrayWriter(), { level: 9 })
  for (const entry of entries) {
    const name = `${root}/${entry.name}`
    if (entry.source) {
      await writer.add(name, new Uint8ArrayReader(new Uint8Array(await Bun.file(entry.source).arrayBuffer())))
      continue
    }
    await writer.add(name, new TextReader(entry.content ?? ""))
  }

  await fs.mkdir(input.outputDir, { recursive: true })
  await Bun.write(archive, await writer.close())
  await Bun.write(`${archive}.sha256`, `${await hashFile(archive)}  ${path.basename(archive)}\n`)
  return { archive, checksum: `${archive}.sha256`, root }
}

async function hashEntry(entry: ArchiveEntry) {
  if (entry.source) return hashFile(entry.source)
  return createHash("sha256")
    .update(entry.content ?? "")
    .digest("hex")
}

async function hashFile(file: string) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest("hex")
}

const minimaxConfig = `{
  "model": "minimax-direct/MiniMax-M2.7",
  "small_model": "minimax-direct/MiniMax-M2.7",
  "provider": {
    "minimax-direct": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiniMax (直连)",
      "options": {
        "baseURL": "https://api.minimaxi.com/v1",
        "apiKey": "{env:MINIMAX_API_KEY}"
      },
      "models": {
        "MiniMax-M2.7": { "name": "MiniMax M2.7" },
        "MiniMax-M2.7-highspeed": { "name": "MiniMax M2.7 (highspeed)" }
      }
    }
  }
}
`

const internalConfig = `{
  "model": "internal/MODEL_ID",
  "small_model": "internal/MODEL_ID",
  "provider": {
    "internal": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Internal OpenAI-compatible Service",
      "options": {
        "baseURL": "http://INTERNAL_MODEL_HOST:PORT/v1",
        "apiKey": "{env:HYPERCODE_INTERNAL_API_KEY}"
      },
      "models": {
        "MODEL_ID": { "name": "Internal Model" }
      }
    }
  }
}
`

const installCommand = `@echo off\r
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*\r
if errorlevel 1 pause\r
`

const installScript = `param(
  [ValidateSet("Auto", "Standard", "Baseline")]
  [string]$Variant = "Auto",
  [ValidateSet("Minimax", "Internal")]
  [string]$Provider = "Minimax",
  [string]$InstallDir = "$env:LOCALAPPDATA\\HyperCode\\bin",
  [string]$LicensePath,
  [string]$MinimaxApiKey,
  [string]$InternalBaseUrl,
  [string]$InternalModelId,
  [string]$InternalApiKey,
  [switch]$ForceConfig,
  [switch]$SkipVSCodeExtension,
  [switch]$SkipGit
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-VSCodeCommand {
  $Command = Get-Command code.cmd -ErrorAction SilentlyContinue
  if ($Command) { return $Command.Source }

  $Candidates = @(
    "$env:LOCALAPPDATA\\Programs\\Microsoft VS Code\\bin\\code.cmd",
    "$env:ProgramFiles\\Microsoft VS Code\\bin\\code.cmd"
  )
  return $Candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Install-Config {
  $ConfigDir = Join-Path $env:USERPROFILE ".config\\opencode"
  $ConfigFile = Join-Path $ConfigDir "hypercode.json"
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  if ((Test-Path -LiteralPath $ConfigFile) -and -not $ForceConfig) {
    Write-Host "Preserved existing config: $ConfigFile"
    return
  }

  if ($Provider -eq "Minimax") {
    Copy-Item -LiteralPath (Join-Path $PackageRoot "config\\minimax-direct.json") -Destination $ConfigFile -Force
    Write-Host "Installed MiniMax config: $ConfigFile"
    return
  }

  if (-not $InternalBaseUrl -or -not $InternalModelId) {
    throw "Internal provider requires -InternalBaseUrl and -InternalModelId."
  }
  $Config = [ordered]@{
    model = "internal/$InternalModelId"
    small_model = "internal/$InternalModelId"
    provider = [ordered]@{
      internal = [ordered]@{
        npm = "@ai-sdk/openai-compatible"
        name = "Internal OpenAI-compatible Service"
        options = [ordered]@{
          baseURL = $InternalBaseUrl.TrimEnd("/")
          apiKey = "{env:HYPERCODE_INTERNAL_API_KEY}"
        }
        models = [ordered]@{
          $InternalModelId = [ordered]@{ name = $InternalModelId }
        }
      }
    }
  }
  $Config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ConfigFile -Encoding UTF8
  Write-Host "Installed internal provider config: $ConfigFile"
}

if ($env:OS -ne "Windows_NT" -or -not [Environment]::Is64BitOperatingSystem) {
  throw "This package requires 64-bit Windows."
}

Get-Content -LiteralPath (Join-Path $PackageRoot "SHA256SUMS.txt") | ForEach-Object {
  if ($_ -notmatch "^([0-9a-f]{64})  (.+)$") { throw "Invalid checksum entry: $_" }
  $File = Join-Path $PackageRoot $Matches[2]
  if (-not (Test-Path -LiteralPath $File)) { throw "Package file is missing: $File" }
  if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Matches[1]) {
    throw "Checksum verification failed: $File"
  }
}
Write-Host "Package checksums verified."

$GitInstaller = Join-Path $PackageRoot "installers\\GitSetup.exe"
if (-not $SkipGit -and -not (Get-Command git.exe -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $GitInstaller)) {
  $GitInstall = Start-Process -FilePath $GitInstaller -ArgumentList "/VERYSILENT", "/NORESTART", "/CURRENTUSER" -Wait -PassThru
  if ($GitInstall.ExitCode -notin 0, 3010) { throw "Git installation failed with exit code $($GitInstall.ExitCode)." }
}

$Code = Resolve-VSCodeCommand
if (-not $SkipVSCodeExtension -and -not $Code) {
  $VSCodeInstaller = Join-Path $PackageRoot "installers\\VSCodeSetup.exe"
  if (-not (Test-Path -LiteralPath $VSCodeInstaller)) {
    throw "VS Code is not installed and this package does not include a VS Code installer."
  }
  $VSCodeInstall = Start-Process -FilePath $VSCodeInstaller -ArgumentList "/VERYSILENT", "/NORESTART", "/MERGETASKS=!runcode,addcontextmenufiles,addcontextmenufolders,addtopath" -Wait -PassThru
  if ($VSCodeInstall.ExitCode -notin 0, 3010) { throw "VS Code installation failed with exit code $($VSCodeInstall.ExitCode)." }
  $Code = Resolve-VSCodeCommand
  if (-not $Code) { throw "VS Code installation completed but code.cmd was not found." }
}

if ($Variant -eq "Auto") {
  try {
    Add-Type -TypeDefinition '[DllImport("kernel32.dll")] public static extern bool IsProcessorFeaturePresent(int feature);' -Name NativeMethods -Namespace HyperCode
    $Variant = if ([HyperCode.NativeMethods]::IsProcessorFeaturePresent(40)) { "Standard" } else { "Baseline" }
  } catch {
    $Variant = "Baseline"
  }
}

$Source = if ($Variant -eq "Standard") {
  Join-Path $PackageRoot "bin\\standard\\hypercode.exe"
} else {
  Join-Path $PackageRoot "bin\\baseline\\hypercode.exe"
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -LiteralPath $Source -Destination (Join-Path $InstallDir "hypercode.exe") -Force
$HyperCode = Join-Path $InstallDir "hypercode.exe"

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathParts = @($UserPath -split ";" | Where-Object { $_ })
if (-not ($PathParts | Where-Object { $_.TrimEnd("\\") -ieq $InstallDir.TrimEnd("\\") })) {
  [Environment]::SetEnvironmentVariable("Path", (@($PathParts + $InstallDir) -join ";"), "User")
}
$env:Path = "$InstallDir;$env:Path"

[Environment]::SetEnvironmentVariable("HYPERCODE_DISABLE_MODELS_FETCH", "1", "User")
[Environment]::SetEnvironmentVariable("HYPERCODE_DISABLE_AUTOUPDATE", "1", "User")
$env:HYPERCODE_DISABLE_MODELS_FETCH = "1"
$env:HYPERCODE_DISABLE_AUTOUPDATE = "1"
if ($MinimaxApiKey) {
  [Environment]::SetEnvironmentVariable("MINIMAX_API_KEY", $MinimaxApiKey, "User")
  $env:MINIMAX_API_KEY = $MinimaxApiKey
}
if ($InternalApiKey) {
  [Environment]::SetEnvironmentVariable("HYPERCODE_INTERNAL_API_KEY", $InternalApiKey, "User")
  $env:HYPERCODE_INTERNAL_API_KEY = $InternalApiKey
}

Install-Config

if ($LicensePath) {
  if (-not (Test-Path -LiteralPath $LicensePath)) { throw "License file does not exist: $LicensePath" }
  New-Item -ItemType Directory -Force -Path "C:\\hyper-aicode" | Out-Null
  Copy-Item -LiteralPath $LicensePath -Destination "C:\\hyper-aicode\\license.txt" -Force
}

if (-not $SkipVSCodeExtension) {
  & $Code --install-extension (Join-Path $PackageRoot "extension\\hypercode.vsix") --force
  if ($LASTEXITCODE -ne 0) { throw "VS Code extension installation failed." }
}

& $HyperCode --version
Write-Host "Machine ID:"
& $HyperCode license machine-id
if (Test-Path -LiteralPath "C:\\hyper-aicode\\license.txt") {
  & $HyperCode license status
}

Write-Host ""
Write-Host "HyperCode installation completed."
Write-Host "CLI: $HyperCode"
Write-Host "Variant: $Variant"
Write-Host "Provider: $Provider"
Write-Host "Restart PowerShell and VS Code before use."
`

const readme = (version: string) => `# HyperCode Windows x64 离线安装包

版本：${version}

## 最少操作安装

解压完整 ZIP，不要只复制单个 EXE。以最终使用 HyperCode 的 Windows 用户运行：

\`\`\`powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1
\`\`\`

也可以双击 \`install.cmd\`。脚本会完成：

- 校验包内所有文件的 SHA-256
- 自动选择 AVX2 标准版或 baseline 兼容版
- 安装 CLI 到当前用户的 \`%LOCALAPPDATA%\\HyperCode\\bin\`
- 将 CLI 目录加入用户 PATH
- 安装包内 VS Code（仅在提供离线安装器且目标机未安装时）
- 安装 \`hypercode.vsix\`
- 安装默认 MiniMax 配置
- 禁止公共模型目录刷新和自动更新
- 输出 License 机器码

## License

首次安装输出机器码后，在受控管理员电脑生成 \`license.txt\`，再运行：

\`\`\`powershell
.\\install.ps1 -LicensePath D:\\transfer\\license.txt
\`\`\`

License 固定安装到 \`C:\\hyper-aicode\\license.txt\`。

## MiniMax

默认配置使用 \`minimax-direct/MiniMax-M2.7\` 和公网地址 \`https://api.minimaxi.com/v1\`。如需在可访问该地址的环境中调用模型：

\`\`\`powershell
.\\install.ps1 -MinimaxApiKey "YOUR_KEY" -ForceConfig
\`\`\`

无法访问外网的虚拟机只能完成 CLI、VSIX、License 和界面调试，不能直接调用该公网 MiniMax 服务。需要由内网代理或模型网关提供可达地址。

## 预留内网模型

包内 \`config/internal-openai-compatible.json.example\` 是内网模板。内网模型服务就绪后运行：

\`\`\`powershell
.\\install.ps1 \`
  -Provider Internal \`
  -InternalBaseUrl "http://model-gateway:8000/v1" \`
  -InternalModelId "MODEL_ID" \`
  -InternalApiKey "INTERNAL_KEY" \`
  -ForceConfig
\`\`\`

## 常用选项

\`\`\`powershell
.\\install.ps1 -Variant Baseline
.\\install.ps1 -SkipVSCodeExtension
.\\install.ps1 -SkipGit
\`\`\`

## 验收

\`\`\`powershell
hypercode --version
hypercode license status
hypercode debug config
hypercode models minimax-direct
\`\`\`

如使用内网模型，把最后一条改为 \`hypercode models internal\`。
`
