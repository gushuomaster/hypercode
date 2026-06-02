# HyperCode Binary Plugin Distribution

## Current Scope

- Windows CLI binary
- VSCode VSIX

## Not In Scope Yet

- npm
- Homebrew
- AUR
- Nix
- source-install distribution
- Marketplace automation rewrite

## CLI Build

```powershell
cd D:\project\hypercode\packages\opencode
bun run build --single
```

## CLI Artifact

- `packages/opencode/dist/hypercode-windows-x64/bin/hypercode.exe`
- Release zip/tar artifact names use `hypercode-*`

## CLI Smoke Test

```powershell
.\packages\opencode\dist\hypercode-windows-x64\bin\hypercode.exe --help
.\packages\opencode\dist\hypercode-windows-x64\bin\hypercode.exe --version
```

## VSIX Build

```powershell
cd D:\project\hypercode\sdks\vscode
bun run package
npx --yes @vscode/vsce package --no-git-tag-version --no-update-package-json --no-dependencies --skip-license -o dist/hypercode.vsix
```

## VSIX Artifact

- `sdks/vscode/dist/hypercode.vsix`

## Kept For Compatibility

- `opencode` CLI alias
- `@opencode-ai/*` package names
- `packages/opencode` directory name
- upstream sync scripts and attribution

