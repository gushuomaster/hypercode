# C-012 Cross-Platform Artifact Baseline

## Scope

本报告建立 C-012 离线交付的 artifact contract 和可重复验证边界；不执行 Linux/Windows compiler build、VSIX 重打包、installer 安装或 production refactor。

| Field | Value |
|---|---|
| Candidate | C-012 — Offline delivery |
| Baseline HEAD | `81ef2c8b0f6d74c85c09fcb34310cf0de90db177` |
| Bun | `1.3.14 (0d9b296a)` |
| Supported offline platforms | Linux x64 Ubuntu 20.04/glibc；Windows x64 |
| macOS | HyperCode 当前没有 `build:offline-macos` 或 macOS 离线 archive builder；不纳入本次 contract，未来新增入口后再建矩阵 |
| Existing validation | `bun test test/script/offline-package.test.ts` → `5 pass / 0 fail`（36 assertions） |
| End-to-end artifact smoke | Windows completed; Linux blocked by compiler download `ConnectionRefused`; installer side-effect execution intentionally not run against a real user profile |

## Artifact contract

### Linux (`build:offline-linux`)

- Archive: gzip-compressed POSIX tar, filename `hypercode-offline-ubuntu20.04-x64-<semver>.tar.gz`。
- Root: `hypercode-offline-ubuntu20.04-x64-<semver>/`。
- Stable entries: `bin/hypercode`、`bin/hypercode-baseline`、`install.sh`、`install-license.sh`、`config/hypercode.json.example`、`config/hypercode.env.example`、`README.zh-CN.md`、`SHA256SUMS`。
- Required modes/types: binaries and shell scripts `0755` regular files；config examples `0644`/`0600`；directories `0755`；tar typeflag directory=`5`、file=`0`、ustar magic。
- Integrity: in-archive `SHA256SUMS` contains one SHA-256 per file; sidecar `<archive>.sha256` contains archive digest and basename。
- Installer contract: Linux + x86_64 + glibc checks, checksum verification, AVX2/ baseline selection, no network/sudo requirement.

### Windows (`build:offline-windows`)

- Archive: ZIP, filename `hypercode-offline-windows-x64-<semver>.zip`。
- Root: `hypercode-offline-windows-x64-<semver>/`。
- Stable entries: `bin/standard/hypercode.exe`、`bin/baseline/hypercode.exe`、`extension/hypercode.vsix`、`config/minimax-direct.json`、`config/internal-openai-compatible.json.example`、`install.ps1`、`install.cmd`、`README.zh-CN.md`、`SHA256SUMS.txt`，以及可选 `installers/VSCodeSetup.exe`、`installers/GitSetup.exe`。
- Integrity: `SHA256SUMS.txt` lists normalized `/` paths; sidecar `<archive>.sha256` contains archive digest and basename。
- Installer contract: 64-bit Windows check, checksum verification, Standard/Baseline selection, current-user install path, optional VS Code/Git installer, VSIX install, config creation/preservation, license path handling。

## Platform matrix

| Platform | Builder/fixture evidence | Contract fields verified | Missing evidence | Status |
|---|---|---|---|---|
| Windows x64 | `bun test test/script/offline-package.test.ts` with fixture binaries/VSIX/installers；PowerShell parser and source-selection checks | ZIP entries, installer syntax, variant source paths, config/checksum text | Native Bun compiler downloads/builds, real VSIX install, installer side effects on clean user profile | `PARTIAL_BASELINE` |
| Linux x64 | Same test verifies tar headers, modes, entries, checksums；builder statically resolves two compiler targets | tar format, modes, executable/config names, README/install/checksum text | Native/cross Bun compiler build, Ubuntu 20.04 execution, AVX2 detection and install smoke | `PARTIAL_BASELINE` |
| macOS | No HyperCode offline entrypoint/builder exists | None applicable | Entire artifact contract | `NOT_IN_SCOPE` |

## Fresh Windows build evidence

Command: `bun run script/build-offline-windows.ts --version 1.18.30` on Windows x64 with Bun `1.3.14`.

- Downloaded and checksum-validated `windows-x64` and `windows-x64-baseline` Bun compilers.
- Built both binaries; each `--version` smoke returned `1.18.30`.
- Ran VS Code `check-types`, lint step, esbuild production bundle, and `@vscode/vsce package`; produced `sdks/vscode/dist/hypercode.vsix` (718,397 bytes).
- Produced `release-artifacts/hypercode-offline-windows-x64-1.18.30.zip` (124,167,284 bytes) and sidecar checksum `acbf3e505405d8696bffbffa078ca97cfe07e85720547e382e7bd3d737f111c3`.
- ZIP semantic listing contains the two binaries, VSIX, configs, installers scripts, README and `SHA256SUMS.txt`; no installer was executed because it writes user PATH/config and would require a separately isolated Windows profile/registry.

## Linux attempt evidence

Command: `bun run script/build-offline-linux.ts --version 1.18.30`.

The standard compiler download began, but the baseline compiler request failed with `Unable to connect ... bun-linux-x64-baseline.zip` / `ConnectionRefused`. No Linux compiler artifact or archive is claimed.

## Stable vs nondeterministic fields

Stable and regression-suitable: archive format, semver filename/root, entry names, file count, executable/config modes, tar typeflags, checksum list paths, script/config/README content, and sidecar naming format.

Potentially nondeterministic: ZIP/tar archive byte-for-byte digest (writer metadata/compression/runtime versions), compiler binary bytes, VSIX generated metadata, installer vendor binaries, and filesystem ordering unless explicitly normalized. Compare semantic manifests and per-entry checksums before comparing archive bytes.

## Readiness ruling

- Fixture coverage is reliable for archive helpers and script text, but it cannot prove compiler downloads, native binaries, VSIX packaging, installer execution, or clean-profile side effects.
- Current package boundaries are already explicit: root entrypoints delegate to two platform-specific builders; Linux tar and Windows ZIP are distinct responsibilities. A common extraction would add an import/module edge and is not a demonstrated Fork Tax reduction.
- Dependency topology, manifests, `bun.lock`, executable names, config paths, installer behavior, and release artifact contracts are immutable guardrails.

`C012_NOT_READY_FOR_PHASE_5B`

Required before implementation: reproducible Linux/Windows compiler artifact runs, Windows VSIX/package/install matrix, clean-profile installer checks, and checksum/manifest capture for at least one version per platform. No Linux/macOS result is fabricated by this report.
