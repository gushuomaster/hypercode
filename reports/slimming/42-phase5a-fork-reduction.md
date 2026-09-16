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

## C-002 — Bundled config bootstrap

- Bootstrap implementation sources: `2 → 1`.
- Duplicate bootstrap ownership: `2 → 1`.
- Modified upstream production files: `1 → 1` (`packages/opencode/src/config/config.ts`).
- Modified upstream symbols: `2 → 2`; `loadGlobal` remains and bootstrap is consolidated under `bootstrapGlobalConfig`.
- Technical delta: `9 insertions / 10 deletions`, net `-1` line in the touched file.
- Core patches: unchanged (`55 → 55`).
- Compatibility behavior count: unchanged; schema, legacy migration, filenames, precedence, and public Config API remain intact.
- Frozen-area interaction: `NONE`.
- Lockfile/manifests: unchanged.
- Complexity Delta: `LOWER`; Net Fork Tax: `REDUCED`.

## C-005 — Retry copy/resource preflight

- Production implementation: `NOT_EXECUTED`.
- Current production source-of-truth count: `1`; proposed extraction would remain `1` while increasing production files `1 → 2` and adding one import edge.
- Modified upstream files: no reduction; compatibility and retry behavior unchanged.
- Fork Tax result: `NO_NET_BENEFIT`.
- Complexity Delta: not applicable to production (no change); extraction would have been `HIGHER` through unnecessary indirection.

## C-007 — xAI OAuth flow preflight

- Implementation: `NOT_EXECUTED` due overlapping dirty sync repair and frozen Plugin architecture.
- Current surface: `1` modified upstream file with approximately `352` added custom lines; no exact duplicate implementation.
- Simulated extraction: files `1 → 2`, import edges `+1`, wrapper `+1`, modified upstream files unchanged; Complexity Delta `HIGHER`.
- Fork Tax result: `BLOCKED_BY_GUARDRAIL`; no Phase 5A reduction.

## C-012 — Offline delivery boundary preflight

- Implementation: `NOT_EXECUTED`; current explicit package boundary retained.
- Simulated common archive extraction: files `7 → 8`, imports `+1`, upstream patch count unchanged; Complexity Delta `HIGHER`.
- Fork Tax result: `DEFER_PHASE5B`; no Phase 5A reduction.
