import { createReadStream, createWriteStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { once } from "node:events"
import { createHash } from "node:crypto"
import { createGzip } from "node:zlib"

interface ArchiveEntry {
  name: string
  mode: number
  type: "file" | "directory"
  source?: string
  content?: string
}

export async function createOfflineLinuxPackage(input: {
  version: string
  outputDir: string
  standardBinary: string
  baselineBinary: string
}) {
  const root = `hypercode-offline-ubuntu20.04-x64-${input.version}`
  const archive = path.join(input.outputDir, `${root}.tar.gz`)
  const entries: ArchiveEntry[] = [
    { name: root, mode: 0o755, type: "directory" },
    { name: `${root}/bin`, mode: 0o755, type: "directory" },
    { name: `${root}/config`, mode: 0o755, type: "directory" },
    { name: `${root}/bin/hypercode`, mode: 0o755, type: "file", source: input.standardBinary },
    { name: `${root}/bin/hypercode-baseline`, mode: 0o755, type: "file", source: input.baselineBinary },
    { name: `${root}/install.sh`, mode: 0o755, type: "file", content: installScript },
    { name: `${root}/install-license.sh`, mode: 0o755, type: "file", content: installLicenseScript },
    { name: `${root}/config/hypercode.json.example`, mode: 0o644, type: "file", content: configTemplate },
    { name: `${root}/config/hypercode.env.example`, mode: 0o600, type: "file", content: environmentTemplate },
    { name: `${root}/README.zh-CN.md`, mode: 0o644, type: "file", content: readme(input.version) },
  ]
  const checksums = await Promise.all(
    entries
      .filter((entry) => entry.type === "file")
      .map(async (entry) => `${await hashEntry(entry)}  ${entry.name.slice(root.length + 1)}`),
  )

  entries.push({
    name: `${root}/SHA256SUMS`,
    mode: 0o644,
    type: "file",
    content: `${checksums.join("\n")}\n`,
  })

  await fs.mkdir(input.outputDir, { recursive: true })
  await fs.rm(archive, { force: true })
  await writeTarGzip(archive, entries)
  await Bun.write(`${archive}.sha256`, `${await hashFile(archive)}  ${path.basename(archive)}\n`)
  return { archive, checksum: `${archive}.sha256`, root }
}

export function createTarHeader(input: { name: string; mode: number; size: number; type: "file" | "directory" }) {
  if (Buffer.byteLength(input.name) > 100) throw new Error(`Tar path is too long: ${input.name}`)

  const header = Buffer.alloc(512)
  header.write(input.name, 0, 100, "utf8")
  writeOctal(header, input.mode, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, input.size, 124, 12)
  writeOctal(header, 0, 136, 12)
  header.fill(0x20, 148, 156)
  header.write(input.type === "directory" ? "5" : "0", 156, 1, "ascii")
  header.write("ustar\0", 257, 6, "ascii")
  header.write("00", 263, 2, "ascii")
  header.write("root", 265, 32, "ascii")
  header.write("root", 297, 32, "ascii")

  const checksum = header.reduce((sum, value) => sum + value, 0).toString(8).padStart(6, "0")
  header.write(`${checksum}\0 `, 148, 8, "ascii")
  return header
}

async function writeTarGzip(output: string, entries: ArchiveEntry[]) {
  const destination = createWriteStream(output)
  const gzip = createGzip({ level: 9 })
  gzip.pipe(destination)

  const write = async (value: Uint8Array) => {
    if (gzip.write(value)) return
    await once(gzip, "drain")
  }

  for (const entry of entries) {
    const size = entry.type === "directory" ? 0 : await entrySize(entry)
    await write(createTarHeader({ name: entry.name, mode: entry.mode, size, type: entry.type }))
    if (entry.type === "directory") continue

    if (entry.source) {
      for await (const chunk of createReadStream(entry.source)) await write(chunk)
    }
    if (entry.content !== undefined) await write(Buffer.from(entry.content))

    const padding = (512 - (size % 512)) % 512
    if (padding) await write(Buffer.alloc(padding))
  }

  await write(Buffer.alloc(1024))
  gzip.end()
  await Promise.race([
    once(destination, "close"),
    once(destination, "error").then(([error]) => Promise.reject(error)),
    once(gzip, "error").then(([error]) => Promise.reject(error)),
  ])
}

function entrySize(entry: ArchiveEntry) {
  if (entry.source) return fs.stat(entry.source).then((stat) => stat.size)
  return Buffer.byteLength(entry.content ?? "")
}

async function hashEntry(entry: ArchiveEntry) {
  if (entry.source) return hashFile(entry.source)
  return createHash("sha256").update(entry.content ?? "").digest("hex")
}

async function hashFile(file: string) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest("hex")
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number) {
  const octal = value.toString(8).padStart(length - 1, "0")
  if (octal.length >= length) throw new Error(`Tar numeric field is too large: ${value}`)
  buffer.write(`${octal}\0`, offset, length, "ascii")
}

const installScript = `#!/bin/sh
set -eu

variant=auto
install_dir="\${HOME}/.local/bin"

usage() {
  cat <<'EOF'
Usage: ./install.sh [--variant auto|standard|baseline] [--install-dir DIR]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --variant)
      [ "$#" -ge 2 ] || { echo "Missing value for --variant" >&2; exit 1; }
      variant="$2"
      shift 2
      ;;
    --install-dir)
      [ "$#" -ge 2 ] || { echo "Missing value for --install-dir" >&2; exit 1; }
      install_dir="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$variant" in
  auto|standard|baseline) ;;
  *) echo "Invalid variant: $variant" >&2; exit 1 ;;
esac

[ "$(uname -s)" = "Linux" ] || { echo "HyperCode offline package only supports Linux." >&2; exit 1; }
[ "$(uname -m)" = "x86_64" ] || { echo "This package requires x86_64; detected $(uname -m)." >&2; exit 1; }

glibc="$(getconf GNU_LIBC_VERSION 2>/dev/null || true)"
case "$glibc" in
  glibc\\ *) ;;
  *) echo "GNU glibc is required; detected: \${glibc:-unknown}." >&2; exit 1 ;;
esac

command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required." >&2; exit 1; }
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
(cd "$script_dir" && sha256sum -c SHA256SUMS)

if [ "$variant" = "auto" ]; then
  if grep -qwi avx2 /proc/cpuinfo 2>/dev/null; then
    variant=standard
  else
    variant=baseline
  fi
fi

binary=bin/hypercode
[ "$variant" = "baseline" ] && binary=bin/hypercode-baseline

mkdir -p "$install_dir"
install -m 755 "$script_dir/$binary" "$install_dir/hypercode"

echo "Installed HyperCode ($variant, $glibc) to $install_dir/hypercode"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) printf 'Add this directory to PATH: export PATH="%s:$PATH"\n' "$install_dir" ;;
esac
"$install_dir/hypercode" --version
`

const installLicenseScript = `#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: ./install-license.sh /path/to/license.txt" >&2
  exit 1
fi

source_file="$1"
[ -f "$source_file" ] || { echo "License file does not exist: $source_file" >&2; exit 1; }
[ -s "$source_file" ] || { echo "License file is empty: $source_file" >&2; exit 1; }

license_dir="\${HOME}/hyper-aicode"
license_file="$license_dir/license.txt"
mkdir -p "$license_dir"
chmod 700 "$license_dir"
install -m 600 "$source_file" "$license_file"

hypercode_bin="\${HYPERCODE_BIN:-}"
if [ -z "$hypercode_bin" ]; then
  hypercode_bin=$(command -v hypercode 2>/dev/null || true)
fi
if [ -z "$hypercode_bin" ] && [ -x "\${HOME}/.local/bin/hypercode" ]; then
  hypercode_bin="\${HOME}/.local/bin/hypercode"
fi
[ -n "$hypercode_bin" ] || { echo "HyperCode is not installed or not in PATH." >&2; exit 1; }

echo "Installed License to $license_file"
"$hypercode_bin" license status
`

const configTemplate = `{
  "$schema": "https://opencode.ai/config.json",
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
        "MODEL_ID": {
          "name": "Internal Model"
        }
      }
    }
  }
}
`

const environmentTemplate = `export HYPERCODE_DISABLE_MODELS_FETCH=1
export HYPERCODE_INTERNAL_API_KEY='REPLACE_WITH_INTERNAL_API_KEY'
`

const readme = (version: string) => `# HyperCode Ubuntu 20.04 离线安装包

版本：${version}  
架构：x86_64  
系统：Ubuntu 20.04（glibc）

## 安装

本包同时包含 AVX2 标准版与 baseline 兼容版，默认自动选择：

\`\`\`bash
./install.sh
export PATH="$HOME/.local/bin:$PATH"
hypercode --version
hypercode license machine-id
\`\`\`

如需手工指定版本：

\`\`\`bash
./install.sh --variant standard
./install.sh --variant baseline
\`\`\`

安装过程不访问网络、不需要 sudo，也不会安装 OpenCode。

## License

虚拟机完成最终部署并确认 \`/etc/machine-id\` 不再变化后，执行：

\`\`\`bash
hypercode license machine-id
\`\`\`

将机器 ID 带到管理员电脑签发 \`license.txt\`，再带回目标机：

\`\`\`bash
./install-license.sh /media/usb/license.txt
hypercode license status
\`\`\`

License 最终保存到 \`~/hyper-aicode/license.txt\`。克隆虚拟机或修改 \`/etc/machine-id\` 后需要重新签发。

## 内网模型配置

复制并修改配置模板，不要把真实密钥写入 U 盘：

\`\`\`bash
mkdir -p ~/.config/opencode
[ -e ~/.config/opencode/hypercode.json ] || cp config/hypercode.json.example ~/.config/opencode/hypercode.json
[ -e ~/.config/opencode/hypercode.env ] || cp config/hypercode.env.example ~/.config/opencode/hypercode.env
chmod 600 ~/.config/opencode/hypercode.json
chmod 600 ~/.config/opencode/hypercode.env
. ~/.config/opencode/hypercode.env
\`\`\`

把模板中的地址、\`MODEL_ID\` 和密钥占位值改成现场值。环境模板默认设置 \`HYPERCODE_DISABLE_MODELS_FETCH=1\`，防止运行时访问公共 \`models.dev\`；可将加载命令加入目标用户的 shell 配置。

## 验收

\`\`\`bash
hypercode --version
hypercode license status
hypercode debug config
hypercode models internal
hypercode run -m internal/MODEL_ID "回复ok"
\`\`\`

模型调用只访问配置的内网服务；依赖公网下载的插件、LSP 等可选功能不包含在本离线包内。
`
