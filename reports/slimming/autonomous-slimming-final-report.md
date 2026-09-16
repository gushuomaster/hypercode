# HyperCode Fork Slimming — Autonomous Final Report

## Overall Result

`STOP_AT_CURRENT_OPTIMUM`

HyperCode 的必要产品能力保持不变；当前证据下已不存在同时满足 High Benefit、Acceptable Risk、Strong Validation 和 Clear Rollback 的剩余候选。继续改动将进入 active compatibility、产品差异或 Frozen architecture，风险高于可证明的 Fork Tax 收益。

## Reusable Baseline

- Upstream: OpenCode 1.18.30, `193de13a88d62a6409c6d385831180f1def527dc`.
- Autonomous implementation start: `747a512d9e841e62af979724709db94443c9869a`.
- Final implementation HEAD: `0cb49cfab` (`refactor(opencode): centralize OpenAPI branding`).
- Environment: Windows, PowerShell UTF-8, Bun `1.3.14`.
- Counting rule for modified upstream files: baseline-existing `M`/`T` paths from `git diff --diff-filter=MT`.
- Production-path rule: modified paths matching `^(packages|sdks)/[^/]+/src/`, excluding test directories.
- Technical changed lines: additions plus deletions for modified `packages/core/src/**` and `packages/opencode/src/**` baseline paths; HyperCode-only added files are excluded.

## Fork Tax

| Metric | Autonomous Start | Final Committed Baseline | Change |
|---|---:|---:|---:|
| Modified upstream files | 147 | 140 | -7 |
| Modified upstream production paths | 99 | 92 | -7 |
| Core patch paths | 55 | 48 | -7 |
| Core/OpenCode technical changed lines | 832 | 798 | -34 |
| Modified upstream symbol groups | ≈76 | ≈70 | ≈-6 |
| Cumulative duplicate maintenance points eliminated | 22 | 42 | +20 eliminated |

The symbol count remains a declaration-level static approximation inherited from `28-symbol-level-fork-surface.md`. C-017 removes seven modified `*Api` symbol groups and adds one private branding helper, for an approximate net reduction of six groups.

The working tree also contains a pre-existing, intentionally preserved `packages/opencode/src/session/processor.ts` delta. Including that uncommitted content changes technical changed lines from `798` to `792`; it is not attributed to C-017 and was not included in its commit.

## Sources of Truth

| Surface | Before | After | Result |
|---|---:|---:|---|
| CLI branding literal sites | 32 | 12 | C-009 centralized repeated product/command literals |
| Environment alias owners | 2 | 1 | C-001 centralized HYPERCODE-first alias names |
| Config bootstrap owners | 2 | 1 | C-002 centralized bundled bootstrap ownership |
| Legacy OpenAPI branding patch sites | 20 | 1 transform boundary | C-017 removed seven upstream-file patches |

C-017 adds no import edge and no wrapper module. The existing legacy OpenAPI normalization boundary in `public.ts` remains the only branding transform owner.

## C-017 — OpenAPI Branding Boundary Reduction

Seven upstream HttpApi group files previously carried description-only `OpenCode → HyperCode` patches. They now match upstream exactly; legacy operation and selected component descriptions are branded once in `public.ts`.

Behavioral boundary:

- Legacy non-`/api` descriptions expose HyperCode branding.
- `/api/*` V2 descriptions are not transformed.
- Route paths, HTTP methods, operation IDs, schemas, component names, responses, security and lifecycle remain unchanged.

Generated-spec A/B result:

| Check | Before | After |
|---|---|---|
| Paths | 162 | 162 |
| Operations | 188 | 188 |
| Schemas | 472 | 472 |
| Route/operationId hash | `b628b08dc114af69147096fd95324e2b795062c433740a54579bd73654f5f487` | same |
| Component-name hash | `0b67b958ca4c08b0de618d6124b2c17864c35d2bb619205b8166437b37566e9d` | same |
| Spec hash with descriptions removed | `89375f869b5ac39b0ffcebe89b52f6140efa89c40c13b656245864a851952a38` | same |
| V2 description hash | `90249e72c0038f0461af76f974a2d136a1b2b5ba223f2a528b8d542783359757` | same |
| Legacy descriptions containing OpenCode | 2 | 0 |

TDD evidence: with the operation transform temporarily absent, `httpapi-branding.test.ts` failed and listed 22 legacy branding violations. Restoring the minimal transform produced `1 pass / 0 fail`.

## Accepted Changes

| Candidate / Repair | Commit | Result |
|---|---|---|
| C-009 CLI branding resource | `f13c32d54` | 20 duplicate branding sites removed |
| C-001 environment aliases | `17dacc365` | alias source of truth `2 → 1` |
| C-002 config bootstrap | `81ef2c8b0` | bootstrap ownership `2 → 1` |
| R-005 xAI sync repair | `fe8c6b1a3` | sync regression repaired; not counted as slimming |
| C-017 OpenAPI branding boundary | `0cb49cfab` | modified upstream/Core paths `-7` |

Each accepted concern has an independent rollback commit. No accepted commits were squashed or mixed with unrelated dirty content.

## Closed or Deferred Work

- C-005: `NO_NET_BENEFIT`; retry message already has one source, extraction adds indirection.
- C-008: `NO_NET_BENEFIT`; shared OAuth callback page already exists.
- C-007: `NO_NET_BENEFIT / GUARDRAIL`; extraction keeps one modified upstream file, adds imports/modules, and crosses Plugin/auth-storage contracts.
- C-012: `ENVIRONMENT_BLOCKED_LOW_PRIORITY`; Windows artifact baseline exists, Linux compiler download remains `ConnectionRefused`, and expected Fork Tax reduction is low.
- C-003: active config filename compatibility; consumers and fresh-home behavior remain proven.
- C-004: `HIGH_RISK_KEEP`; Session dual-write/state behavior remains Frozen.
- C-006: provider registry behavior has only partial upstream overlap and requires runtime provider evidence.
- C-010/C-016: VS Code product/runtime/protocol surface is required product capability and Frozen.
- C-011: Chinese TUI localization/UX is required product capability; architecture remains Frozen.
- C-013/C-014/C-015: license, video workflow and repo-discovered workflows retain product/dynamic consumers; no safe deletion evidence exists.

No candidate was reverted during the autonomous mission. Candidates without measurable benefit were closed without production changes.

## Remaining Thin Patches

The final 48 Core patch paths were re-ranked by changed-line count and branding overlap. The remaining one-line and small patches are not another C-017-style batch:

- CLI/TUI prompts and errors are independent user-visible product strings without a common behavior-preserving output transform.
- Config filenames, environment aliases, command IDs and filesystem names are active compatibility contracts.
- Provider, plugin, MCP, Session and VS Code adapters have runtime or protocol semantics beyond branding.
- Prompt files directly influence model behavior and cannot be normalized as static metadata.

Centralizing these strings through a new global output wrapper would keep or increase upstream path count, add indirection, and widen behavioral risk. It is therefore `NO_NET_BENEFIT` under the mission's maintenance-surface objective.

## Product Capabilities Preserved

- HyperCode branding and Simplified Chinese user experience.
- Existing config filenames, precedence, migration and environment aliases.
- Offline Windows/Linux delivery sources and packaging entrypoints.
- xAI/provider/plugin authentication behavior and persistence contracts.
- Session V2, CLI/TUI behavior, VS Code runtime/protocol integration.
- License, repository workflows and video-replica product functionality.

No route, schema, operation ID, provider lifecycle, auth storage, dependency topology, manifest or lockfile behavior was changed by C-017.

## Validation

- C-017 targeted: `bun test test/server/httpapi-branding.test.ts` → `1 pass / 0 fail`.
- Related OpenAPI/SDK group: four files → `49 pass / 0 fail`.
- Full HttpApi affected area: 34 files → `200 pass / 17 skip / 0 fail`.
- OpenCode typecheck: historical F-013 only at `test/config/config.test.ts:284`; signature is unchanged.
- OpenCode broad: `3610 pass / 58 skip / 1 todo / 7 fail`; the seven failures match the frozen baseline: six Windows symlink `EPERM` failures and one CLI help spacing snapshot.
- Post-cleanup verification: after dependency-store recovery, the OpenAPI/SDK group was rerun at `49 pass / 0 fail`; OpenCode typecheck still reported F-013 only.
- New regressions attributable to C-017: `0`.
- Frozen Area violations: `0`.

## Dependency Integrity

- `bun.lock`: content-identical to HEAD, blob/hash `d1a30094ccd5e607f14859313b2e8ee951577441`.
- `packages/opencode/package.json`: content-identical to HEAD, blob/hash `3f72ba0dc1dc275d53dd63eebfa5294440297147`.
- Their dirty status is line-ending/stat metadata already present before C-017; neither file was staged or committed.
- No dependency, package manifest or workspace topology change was made.
- A temporary detached A/B worktree reused the main dependency store through directory junctions. Its first removal attempt partially removed store targets, leaving the package link for `@ai-sdk/gateway@3.0.104` present but its target absent. This was an environment cleanup defect, not a source or lockfile change.
- Recovery used `bun install --frozen-lockfile --offline` at the worktree root. Bun restored 148 cached packages; the lockfile and manifest hashes remained identical, and the original failing branding test plus the 49-test OpenAPI/SDK group returned green.

## Reproduction Commands

Run tests and typecheck from `packages/opencode`, never from the repository root:

```powershell
bun test test/server/httpapi-branding.test.ts
bun test test/server/httpapi-branding.test.ts test/server/httpapi-public-openapi.test.ts test/server/httpapi-query-schema-drift.test.ts test/server/httpapi-sdk.test.ts
$tests = Get-ChildItem -LiteralPath 'test\server' -Filter 'httpapi-*.test.ts' -File | ForEach-Object FullName
bun test @tests
bun typecheck
bun test --timeout 30000 --only-failures
```

Recompute committed Fork Tax from the repository root:

```powershell
git diff --name-only --diff-filter=MT 193de13a88d62a6409c6d385831180f1def527dc HEAD
git diff --name-only --diff-filter=MT 193de13a88d62a6409c6d385831180f1def527dc HEAD -- packages/core/src packages/opencode/src
git diff --numstat 193de13a88d62a6409c6d385831180f1def527dc HEAD -- packages/core/src packages/opencode/src
```

## Why Execution Stopped

The only newly discovered high-benefit candidate, C-017, is accepted and reduces seven upstream paths with strong generated-spec and server validation. The remaining queue consists of active compatibility, required product surface, low-benefit environment work, or Frozen architectural decisions. Continuing would optimize file count at the expense of behavior confidence or add abstractions without reducing upstream invasiveness.

This is the current evidence-supported optimum, not a claim that future upstream releases can never unlock new replacements. On the next OpenCode upgrade, reuse this report's baseline, rerun the generated-spec hashes, and re-evaluate only when upstream provides a new equivalent boundary or stronger runtime evidence becomes available.

## Phase 12 Closure Addendum

Phase 11 selective replay is now committed in independent responsibility-boundary commits. Final maintenance readiness is `MAINTENANCE_READY_WITH_KNOWN_DEBT` at `e7333ecac2f5f4ce33fe051cfcd0e604f598e910`.

- Final Fork Tax: `141 / 92 / 48 / 792`; the single-file increase from `140` is governance-only `AGENTS.md` replay, while production and core patch counts remain unchanged.
- Core/TUI/VS Code validation passes; OpenCode retains historical F-013 plus the fully attributed user-script-only Doubao debt.
- Broad validation: `3611 pass / 58 skip / 1 todo / 7 fail`; seven failures match known Windows symlink and CLI snapshot signatures; new regression count is `0`.
- Preservation stashes remain retained, and the next maintenance entrypoint is `scripts/sync-opencode-upstream.ps1` with `reports/slimming/post-slimming-baseline.md`.
- See `reports/slimming/phase12-final-maintenance-readiness.md` for the complete 18-point closure record.
