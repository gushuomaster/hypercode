# HyperCode Upstream Sync and Rebrand Guide

## Goal

HyperCode is not a one-time fork. It should continue to pull in opencode upstream updates while preserving:

- HyperCode branding
- the `hypercode.*` command surface
- the enhanced VS Code extension in `sdks/vscode`
- the generic no-license-gate behavior
- existing HyperCode product-layer customizations

## Layer Model

Keep future maintenance work separated into three layers as much as possible:

1. `opencode` upstream source
2. HyperCode rebrand changes
3. HyperCode product enhancements, including the enhanced `sdks/vscode` extension

The main rule is to keep the boundary between these layers visible so future upstream merges are easier to reason about.

## Recommended Sync Flow

When syncing new upstream changes, use this order:

1. Create a new sync branch from current HyperCode `dev`
2. Fetch the latest upstream refs
3. Merge `upstream/dev` or the chosen upstream tag into the sync branch
4. Resolve merge conflicts
5. Re-run the HyperCode rebrand pass
6. Check for old brand residue and fix only intended brand-facing surfaces
7. Re-apply or repair HyperCode product-enhancement layers
8. Run build and extension validation
9. Move to review only after validation passes
10. Do not release directly from the sync branch

## High-Risk Conflict Areas

These areas are most likely to need careful manual review during upstream sync:

- `sdks/vscode`
- root and package `package.json`
- README files
- CLI launch behavior
- workspace/runtime logic
- settings and commands
- build and packaging configuration
- brand-facing strings and assets

## Rebrand Rules

Rebrand is not a blind global replace. The rule is:

`replace what should change, preserve what should not`

Review carefully for:

- `opencode`
- `OpenCode`
- `opencode-ai`
- old command names
- old package metadata
- old README branding

Do not casually rewrite:

- third-party license text
- dependency package names
- protocol text
- compatibility fallback fields
- lockfile content that should only change through package-manager operations

## Validation Requirements

At minimum, after each upstream sync + rebrand pass, run:

```powershell
cd D:\project\hypercode-phase4\sdks\vscode
bun install
bun run check-types
bun run package
```

If the upstream sync also touches the main product, add the relevant project-level typecheck, build, and packaging validation for the affected packages before review.

For the VS Code extension, manually verify at least:

- HyperCode appears in the Activity Bar
- `hypercode.*` commands are available
- Session Panel opens successfully
- `hypercode.cliPath` failure messaging is clear when runtime is missing
- runtime starts after configuring a valid CLI path
- Sessions / Todo / Modified Files / Subagents views work
- no license gate or authorization-blocking behavior appears
