# HyperCode Product Alignment Maintenance Baseline

## Closure status

```text
PHASE_1_CLOSED
PHASE_2A_COMPLETE
PHASE_2B_COMPLETE
PHASE_2C_COMPLETE
PHASE_2D_COMPLETE
PHASE_3_COMPLETE
PHASE_4_COMPLETE
NEGATIVE_AUDIT_COMPLETE
MAINTENANCE_BASELINE_ESTABLISHED
```

Phase 4 implementation baseline is `402a7baf2`. The design and audit matrix are recorded in `2026-09-23-phase-4-final-architecture-closure-design.md`.

## Canonical ownership

`packages/product` is the sole owner of cross-host product behavior:

- model catalog, fallback, recent/favorite updates, variants and agent cycling;
- composer selection and action reset semantics;
- session list selection, lifecycle projection, mutation availability/state/failure recovery and subagent navigation;
- permission/question priority, message/tool/subagent projections and run state;
- provider, MCP, LSP, formatter, locale, theme, command and help capability projections;
- semantic text/error keys while retaining raw diagnostics.

TUI and VSCode own renderer details, host APIs, persistence, SDK/protocol normalization, terminal/editor integration and capability reporting. Raw messages, parts and protocol payloads remain outside Product.

## Negative audit result

Phase 4 removed or replaced these duplicate owners:

- VSCode raw MCP/LSP/formatter aggregate reducers and their dead tests;
- TUI and VSCode independent recent/favorite/variant updates;
- VSCode-only agent cycling and TUI's parallel cycling implementation;
- VSCode incremental reducer navigation fallback and sidebar default-session selection;
- first-party TUI footer/status/sidebar interpretation of raw MCP/LSP status;
- VSCode footer's raw-state memo dependencies and missing formatter projection.

No production references remain for the deleted compatibility helpers. The retained host reducers sort and merge raw protocol entities for rendering only; they do not decide Product availability, fallback or recovery.

## Retained compatibility

The repository does not claim `LEGACY_ZERO`. These paths have active compatibility responsibility and must remain until their removal gate is met:

| Compatibility | Responsibility | Removal gate |
| --- | --- | --- |
| VSCode raw retry/permission/question payloads in `bridge/types.ts` | renderer details not present in Product projection | Product carries equivalent detail payloads and both renderers migrate |
| VSCode `deferredUpdate` and snapshot seeding | asynchronous host/webview delivery and incremental refresh | bridge has an atomic, versioned canonical snapshot path with equivalent performance |
| legacy provider `all/default` fallback | older server/SDK response shapes | supported runtime floor guarantees `config.providers/default` |
| persisted panel/workspace/session restore fallbacks | existing user state | versioned migration is shipped and the compatibility window expires |
| `opencodePath`, legacy panel theme value and flat message model fields | existing settings/message data | explicit deprecation window plus migration coverage |
| TUI `thinking_visibility` and missing theme token fallback | existing KV/theme data | versioned state/theme migration is complete |
| TUI `api.command` shim | v1 plugin API | plugin API v2 becomes the supported minimum |
| localized command description and skill catalog fallbacks | older command payloads | all supported hosts guarantee localized descriptions and complete skill commands |
| raw TUI plugin state for MCP/LSP | public plugin compatibility | a versioned plugin state API replaces it; first-party views must still project through Product |

## Fork Tax

From the pre-Product baseline `8bc11da90` through `402a7baf2`, Product Alignment changes under Product/TUI/VSCode touch 171 files with approximately 7,976 insertions and 1,446 deletions. The maintained surface currently includes:

- 21 Product source modules and 15 Product test files;
- 15 TUI Product adapter files;
- 18 VSCode Product adapter/test files;
- host integration points and shared fixtures required to prove parity.

The principal ongoing cost is adapter maintenance when upstream changes SDK shapes or host UI structure. Product algorithms should remain host-neutral; compatibility branches must stay at adapter/persistence boundaries. Adding a second host-side implementation of ordering, fallback, availability, recovery or mutation state is prohibited.

## Verification baseline

```text
Product full                 62 pass / 0 fail
TUI Product-related          37 pass / 0 fail
VSCode Product-related       60 pass / 0 fail
VSCode provider navigation    3 pass / 0 fail (with preload-vscode)
Product typecheck             pass
TUI typecheck                 pass
VSCode check-types            pass
VSCode package                pass
git diff --check              pass
```

Full suites are a maintenance reference, not a clean-suite claim:

- TUI full: `243 pass / 4 known fail / 1 skip`. Known failures are Windows path separator assertions, stale `opencode` branding expectations and an environment-sensitive diff-viewer render assertion.
- VSCode full: `406 pass / 29 known fail / 18 known errors`. The 29/18 failure set matches the Phase 3 baseline categories: missing runtime `vscode`, CSS animation assertions, autocomplete parity fixtures and the malformed timeline fixture. The pass count decreased from 413 because seven dead host-logic tests were removed during closure.

Therefore the closure claim is `NO_NEW_PRODUCT_ALIGNMENT_REGRESSION`; it is not an assertion that every repository test is green.

## Maintenance rules

1. Add shared behavior to Product first, then adapt both hosts.
2. Every shared rule needs Product tests and, where host input differs, shared-fixture adapter parity tests.
3. Host code may normalize raw data and render Product state, but may not choose a different fallback or recovery target.
4. Unsupported host capabilities remain explicit `unsupported`; do not emulate nonexistent host functionality.
5. Delete compatibility only with zero production references and evidence that protocol, persistence, plugin and supported-runtime obligations have ended.
6. Re-run the focused baseline, all three typechecks and VSCode package for every Product contract change.
7. Do not compare full-suite pass counts without accounting for deleted/added tests; compare failing test identities and categories.
