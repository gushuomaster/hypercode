# Phase 5A C-012 Summary

## Preflight result

`C012_DEFER_PHASE5B`

## Current behavior and scope

- C-012 is the offline delivery boundary for Linux and Windows packages, including standard/baseline binaries, installer scripts, configuration examples, checksums, optional VSIX/installers, and Chinese offline documentation.
- Entry points are root scripts `build:offline-linux` and `build:offline-windows`; they build binaries and delegate archive creation to `packages/opencode/script/offline-package.ts` and `offline-windows-package.ts`.
- `packages/opencode/script/build.ts` supplies target selection and compiler injection; `target.ts` centralizes target resolution. These are already explicit package boundaries, not duplicated runtime implementations.
- Runtime/package consumers are release scripts and operators; the generated archives are external delivery artifacts rather than Session/TUI/provider runtime paths.

## PRE_IMPLEMENTATION_METRICS

| Metric | Current value |
|---|---:|
| Production files in candidate surface | `7` (one upstream build file plus six HyperCode delivery files) |
| Modified upstream production files | `1` (`packages/opencode/script/build.ts`) |
| Modified upstream symbols | target parsing/compile setup in `build.ts` (`~6` logical units) |
| HyperCode delta LOC vs pure upstream | `37 additions / 101 deletions` in `build.ts`; custom package scripts are new files |
| Sources of truth | `1` target resolver; `2` platform-specific archive builders (distinct formats) |
| Duplicate branches | `0` exact; Linux tar and Windows zip are distinct responsibilities |
| Wrappers/adapters | `2` root build entrypoints delegating to package builders |
| Import edges | `2` entrypoint → package-builder edges; existing and intentional |
| Runtime consumers | root release scripts and offline package operators |

## Simulated implementation and Frozen checks

- A common archive/helper extraction would add a module and imports while retaining both platform builders; expected production files would be `7 → 8` and Fork Tax would not decrease.
- Removing or merging target/build branches would alter binary selection, AVX2 baseline behavior, compiler injection, or installer artifacts; no equivalence proof exists.
- Direct Frozen interaction: `NO` with Session/TUI/VS Code runtime/provider lifecycle. Indirect contract interaction: `YES` for dependency topology, VSIX packaging, executable names, installer/config filesystem contracts, and release artifacts.
- Manifest, lockfile, and build-script installation behavior are immutable for this candidate.
- Expected complexity delta for any Phase 5A extraction is `HIGHER`; current layout is already the smallest clear boundary evidenced by static analysis.

## Validation coverage

- Existing package characterization: `bun test test/script/offline-package.test.ts` → `5 pass / 0 fail` (`36 expect()` calls), covering Linux tar headers/archive/checksums and Windows zip/installer/config/checksum contents.
- Static entrypoint inspection confirms both root scripts resolve package builders and enforce platform/semantic-version checks.
- Full clean artifact smoke is unavailable: Linux/Windows Bun compiler downloads, native cross-target builds, VS Code packaging, and release-artifact execution require external binaries/network and platform-specific environments.
- Validation can detect regression: `PARTIAL`; fixture archive tests are reliable, but they do not prove end-to-end compiler/build/package delivery.

## Decision

- Gate: `C012_DEFER_PHASE5B`.
- Implementation: `NOT_EXECUTED`; no C-012 production files, manifests, lockfile, or dependencies changed.
- Reason: the boundary is already explicit, no duplicate source of truth or safe simplification is identified, and the remaining high-value work requires a clean cross-platform artifact baseline outside Phase 5A.
- Phase 5B queue: clean Linux/Windows artifact smoke, VSIX/installers matrix, and release checksum verification before any further slimming.
