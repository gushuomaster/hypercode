# Phase 5A Fork Reduction

## C-009 — CLI branding resource

- Modified upstream files: `9 → 9` (the same CLI paths remain product-customized).
- Modified upstream symbols: unchanged by count; references now resolve through shared `UI.product`/`UI.command` values.
- CLI branding literal sites: `32 → 12` (`20` duplicate sites removed).
- Technical delta LOC for the nine paths versus pure upstream: `35 → 43` (`+8` import/resource plumbing lines).
- Core patches: unchanged (`55` baseline).
- Duplicate implementations: reduced by `20` repeated product/command literals.
- Files deleted: none.
- Files added: none.
- Files simplified: `packages/opencode/src/cli/ui.ts`, `cli/cmd/web.ts`, `upgrade.ts`, `uninstall.ts`, `tui.ts`, `serve.ts`, `run.ts`, `run/splash.ts`, `pr.ts`.
- Frozen-area interaction: `NONE`.
- Lockfile/manifests: unchanged.
- Net Fork Tax: `REDUCED` through centralized branding references and lower duplicate maintenance surface; LOC increase is limited to shared-resource plumbing.
