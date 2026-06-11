# HyperCode VS Code Extension

A full VS Code integration for HyperCode with a workspace sidebar, session tree, session panel, and seeded composer flows.

## Runtime

This extension starts `hypercode serve` on the current machine for each workspace folder it manages.

- Install `hypercode` so it is available on `PATH`, or
- Set `hypercode.cliPath` to an absolute executable path

The extension also supports `hypercode.httpProxy` for runtime startup.

## Features

- Activity Bar container with workspace session navigation
- Session panel with transcript, thinking blocks, tool rendering, diff views, and image preview actions
- Quick session creation from the active editor, current file, or selected explorer files
- Workspace session search, tag filtering, sharing, archiving, and in-place switching
- Todo, modified files, subagents, and session detail side views

## Development

1. `code sdks/vscode` - Open the `sdks/vscode` directory in VS Code. Do not open from repo root for extension debugging.
2. `bun install` - Run inside `sdks/vscode`.
3. Press `F5` to launch an Extension Development Host.

Useful commands:

- `bun run check-types`
- `bun run package`
- `node esbuild.js --watch`
