# Bundled Config Sanitization Design

## Goal

Make the pending bundled-config sync work safe to commit by replacing local-only bundled config content with a public, product-level default template.

## Problem

The current local prototype introduces bundled global config sync in:

- `packages/opencode/src/config/config.ts`
- `packages/opencode/test/config/config.test.ts`

That behavior depends on:

- `packages/opencode/src/config/hypercode-bundled.ts`

The current `hypercode-bundled.ts` content is not repository-safe because it includes:

- real API-key-like values
- machine-specific absolute paths
- local MCP command wiring
- local plugin paths

This means the current change is blocked in both directions:

- committing `config.ts` and `config.test.ts` without `hypercode-bundled.ts` would break imports
- committing all three as-is would leak private/local configuration

## Success Criteria

The bundled-config sync change is safe to commit when all of the following are true:

1. `hypercode-bundled.ts` contains no secrets or machine-specific paths
2. the default bundled config still represents an intentional HyperCode product default
3. the sync logic in `config.ts` continues to work without extra runtime setup
4. tests verify both sync behavior and the absence of sensitive local content

## Options Considered

### Option 1: Minimal Public Template

Keep only:

- `"$schema"`

Optionally keep empty top-level sections such as `provider`, but do not include model defaults.

Pros:

- lowest security risk
- easiest to explain

Cons:

- loses most product opinion
- does not justify the added sync behavior very well

### Option 2: Sanitized Product Defaults

Keep:

- `"$schema"`
- `model`
- `small_model`
- a public provider definition for the intended HyperCode default provider

Replace:

- secret values with environment-token placeholders such as `"{env:MINIMAX_API_KEY}"`

Remove entirely:

- `plugin`
- `mcp`
- local command arrays
- local absolute paths
- user-home-specific environment values

Pros:

- preserves a real HyperCode default experience
- keeps the sync feature meaningful
- avoids committing private or machine-bound content

Cons:

- still encodes a product opinion in repo defaults
- requires a small amount of care in tests and copy

### Option 3: Full Example Config With Placeholders

Keep the current structure, including provider, plugin, and MCP sections, but convert every private value into placeholders.

Pros:

- closest to current local prototype
- most feature-complete example

Cons:

- still mixes repository defaults with installation-specific setup
- higher maintenance burden
- easier for future edits to accidentally reintroduce local coupling

## Recommended Approach

Use **Option 2: Sanitized Product Defaults**.

This is the best balance between product intent and repository safety. It preserves the idea that HyperCode should seed a bundled default config, but limits that seeded file to public, environment-agnostic configuration that can live safely in source control.

## Proposed Design

### 1. Public Bundled Config Shape

`packages/opencode/src/config/hypercode-bundled.ts` will export a JSON string that contains only:

- `"$schema": "https://opencode.ai/config.json"`
- `model`
- `small_model`
- one `provider` entry for `minimax-direct`
- provider metadata and model names
- an `apiKey` value expressed as an environment token placeholder

It will not contain:

- raw API keys
- `D:/...` or `C:\\...` absolute paths
- `plugin` entries
- `mcp` entries
- local executable paths
- user-profile-specific environment values

### 2. Sync Behavior

The existing sync behavior in `packages/opencode/src/config/config.ts` stays conceptually the same:

- if config is not explicitly redirected by env flags, the runtime can sync a bundled `opencode.json`
- the sync continues to be skipped in tests unless `OPENCODE_FORCE_BUNDLED_GLOBAL_CONFIG_SYNC=1`
- the bundled file is seeded only when the target global config file does not already exist
- existing user-managed `opencode.json` content must not be overwritten by bundled defaults

This keeps the customer-first-install experience while preserving any later user edits to global config.

### 3. Test Strategy

Keep the existing config-sync tests and extend them to verify repository safety.

Required coverage:

- bundled config is written to `opencode.json` when sync is enabled
- existing `opencode.json` content is preserved when the file already exists
- bundled content does not contain raw local path markers
- bundled content does not contain raw API-key-like values
- bundled content still includes the intended public defaults, such as `model` and schema

### 4. Scope Boundaries

This change does **not** attempt to solve:

- local developer bootstrap for plugins or MCP
- private deployment-time secret injection
- end-user environment provisioning

Those remain outside repo defaults and should be handled through local config, deployment instructions, or runtime environment variables.

## File Plan

Modify:

- `packages/opencode/src/config/hypercode-bundled.ts`
- `packages/opencode/src/config/config.ts`
- `packages/opencode/test/config/config.test.ts`

Do not modify as part of this scope:

- `packages/opencode/config.json`
- `tools/*`
- `scripts/format_customer_word.py`
- `docs/用户指南/word/*`

## Risks And Mitigations

### Risk: Placeholder format is not actually supported by downstream config loading

Mitigation:

- keep the placeholder in the same token style already used elsewhere in config parsing
- verify config-sync tests still pass after writing the bundled file

### Risk: Product defaults become too opinionated for all environments

Mitigation:

- restrict defaults to model/provider identity only
- keep installation-specific behavior out of the bundled file

### Risk: Future edits reintroduce secrets or paths

Mitigation:

- add explicit assertions in config tests for absence of local path and raw key markers

## Implementation Notes

Implementation should follow TDD:

1. add a failing test that asserts the bundled config content is sanitized
2. run the focused config test file and confirm the failure is for the expected reason
3. update `hypercode-bundled.ts` to the sanitized form
4. rerun focused config tests
5. rerun `bun typecheck` in `packages/opencode`

## Expected Outcome

After this change, the remaining config-sync work can be committed safely as a focused follow-up commit on the current branch, without exposing local secrets or machine-specific setup.
