# HyperCode Upstream Sync Procedure

This document defines the standard procedure for syncing future OpenCode upstream updates into HyperCode.

## Project Relationship

```txt
origin   = HyperCode private repo
upstream = OpenCode upstream repo
```

```txt
origin   https://github.com/gushuomaster/hypercode.git
upstream https://github.com/anomalyco/opencode.git
```

```txt
Never push to upstream.
upstream push must remain DISABLED.
```

## Sync Preconditions

Before any upstream sync work starts:

```powershell
cd D:\project\hypercode

git switch dev
git pull origin dev
git status --short --untracked-files=all
```

Requirements:

```txt
dev must be clean
no release-artifacts
no dist
no node_modules
no .opencode.old
no uncommitted source changes
```

## Create A Sync Drill Branch

Always fetch upstream first and use the upstream HEAD branch as the source of truth.

```powershell
cd D:\project\hypercode

git fetch upstream
git remote show upstream
git switch dev

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
git switch -c "sync-drill/opencode-upstream-$stamp"
```

Current verified upstream default branch:

```txt
dev
```

## Merge Upstream

```powershell
git merge upstream/dev
```

If conflicts happen:

```txt
Do not abort immediately.
Do not push.
Analyze each conflict file one by one first.
```

Conflict resolution rules:

```txt
1. Preserve upstream functional changes
2. Preserve HyperCode user-visible branding
3. Preserve internal opencode compatibility
4. Do not modify @opencode-ai/*
5. Do not rename packages/opencode
6. Do not change provider id = opencode
7. Do not remove the opencode CLI compatibility entry
8. Preserve OPENCODE_* fallback behavior
```

## Known High-Risk Conflict Files

These files already conflicted in a real upstream sync drill and should be reviewed carefully:

```txt
packages/core/src/flag/flag.ts
packages/opencode/src/cli/logo.ts
packages/tui/src/app.tsx
packages/tui/src/attention.ts
packages/tui/src/routes/session/index.tsx
sdks/vscode/package.json
```

These usually involve:

```txt
CLI logo
TUI user-visible branding
flag/env fallback behavior
VSCode extension metadata
```

## Run The Hardened Rebrand Script

Dry-run first:

```powershell
cd D:\project\hypercode

node scripts/rebrand-opencode-to-hypercode.mjs --dry-run --report
```

Review the report carefully. Focus on:

```txt
protected
manual-check-required
patchable
```

Only if the dry-run is reasonable:

```powershell
node scripts/rebrand-opencode-to-hypercode.mjs --write --report
```

Stop immediately if the script plans to modify:

```txt
@opencode-ai/*
provider id
opencode.* command id
OPENCODE_* fallback
```

## Branding Checklist

After merge and rebrand, verify these user-visible brand points:

```txt
CLI help shows HyperCode
CLI subtitle shows AI coding agent
TUI does not show an opencode top logo
TUI does not show OpenCode Zen
provider.id remains opencode
provider display name is HyperCode Zen
VSCode extension name is hypercode
VSCode displayName is HyperCode
VSCode description is HyperCode for VS Code
VSCode launch command is hypercode --port
VSIX file name is hypercode.vsix
Windows dist is hypercode-windows-x64
exe is hypercode.exe
HYPERCODE_* takes priority
OPENCODE_* fallback remains available
```

Useful search command:

```powershell
rg -n "opencode --port|OpenCode Zen|opencode for VS Code|opencode\.vsix|opencode-windows|opencode\.exe|ghcr.io/anomalyco/opencode|docker run -it --rm ghcr.io/anomalyco/opencode" packages sdks README.md docs scripts .github
```

Classify matches as:

```txt
user-visible residue: must fix
internal compatibility item: allowed to keep
upstream attribution: should keep
release ecosystem / post-release item: track separately
test / fixture item: classify before changing
```

## Typecheck And EXE Build

```powershell
cd D:\project\hypercode

bun turbo typecheck

cd D:\project\hypercode\packages\opencode
bun typecheck
bun run build --single
```

Verify the built EXE:

```powershell
cd D:\project\hypercode

.\packages\opencode\dist\hypercode-windows-x64\bin\hypercode.exe --help
.\packages\opencode\dist\hypercode-windows-x64\bin\hypercode.exe --version
```

Requirements:

```txt
--help must show HyperCode
--version must succeed
dist directory must be hypercode-windows-x64
exe file must be hypercode.exe
```

## VSIX Build Prerequisite

`sdks/vscode` is not part of the root workspace.

```txt
Do not assume a root bun install prepares VSCode extension dependencies.
```

You must run this first:

```powershell
cd D:\project\hypercode\sdks\vscode
bun install
```

Then package the VSIX:

```powershell
npx --yes @vscode/vsce package `
  --no-git-tag-version `
  --no-update-package-json `
  --no-dependencies `
  --skip-license `
  -o dist/hypercode.vsix
```

If `bun install` is skipped, you can hit errors like:

```txt
Cannot find module 'vscode'
Cannot find name 'setTimeout'
Cannot find name 'fetch'
```

## VSIX Verification

Unpack and inspect the packaged VSIX:

```powershell
Remove-Item -Recurse -Force D:\test\hypercode-vsix-inspect -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force D:\test\hypercode-vsix-inspect

Copy-Item `
  .\sdks\vscode\dist\hypercode.vsix `
  D:\test\hypercode-vsix-inspect\hypercode.zip `
  -Force

Expand-Archive `
  D:\test\hypercode-vsix-inspect\hypercode.zip `
  -DestinationPath D:\test\hypercode-vsix-inspect\unzipped `
  -Force
```

Search the unpacked content:

```powershell
rg -n "opencode --port|opencode for VS Code|""title"".*opencode|""category"".*opencode" D:\test\hypercode-vsix-inspect\unzipped
```

Requirements:

```txt
opencode --port must not exist
user-visible opencode for VS Code must not exist
internal opencode.* command ids may remain
```

## Merge-Back Criteria

Only consider merging the sync branch back to `dev` if all of the following are true:

```txt
all conflicts resolved
rebrand dry-run/write did not miswrite internal items
bun turbo typecheck passed
packages/opencode bun typecheck passed
build --single passed
exe help/version passed
VSIX package passed
branding checks passed
manual exe + VSIX acceptance passed
```

Before any merge-back:

```powershell
git status --short --untracked-files=all
```

Confirm there is no:

```txt
node_modules
dist
release-artifacts
zip/exe/vsix/SHA
.opencode.old
```

## Never Do These

```txt
Do not globally replace opencode -> hypercode
Do not modify @opencode-ai/*
Do not rename packages/opencode
Do not change provider id
Do not remove the opencode CLI compatibility entry
Do not remove OPENCODE_* fallback
Do not remove .opencode fallback
Do not push upstream
Do not force push
Do not promote a sync-drill branch directly into a release branch
Do not commit node_modules / dist / release artifacts
```

## Current Verified Conclusion

```txt
Current verified conclusion:
OpenCode upstream sync is feasible for HyperCode.
It requires manual conflict resolution and independent VSIX dependency installation.
The hardened rebrand script is suitable for dry-run auditing and low-risk user-visible patches, but high-risk business source brand points remain manual-check-required.
```
