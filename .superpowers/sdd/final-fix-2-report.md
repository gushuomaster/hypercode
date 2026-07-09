## Final Fix 2

### Exact fixes

- `packages/opencode/test/license/license.test.ts`
  - Replaced the `* as License` import with named imports from `../../src/license/license`.
  - Gated both Windows-only PowerShell fallback tests with `test.if(process.platform === "win32")` so the fallback coverage does not fail on non-Windows platforms.
- `packages/opencode/src/config/config.ts`
  - Reused `hasExistingGlobalConfigFile()` in the global schema/default seeding path so any recognized existing global config, including legacy `config`, blocks creation of a new seeded `hypercode.jsonc` or related first-install artifact before migration finishes.
- `packages/opencode/test/config/config.test.ts`
  - Strengthened the legacy global config regression to assert that `opencode.json`, `opencode.jsonc`, `hypercode.json`, and `hypercode.jsonc` are all absent when legacy `config` exists, while `config.json` is still created by migration.

### Commands and results

- `bun test --timeout 30000 test/config/config.test.ts`
  - Result: pass
  - Summary: `101 pass, 0 fail`
- `bun test --timeout 30000 test/license/license.test.ts`
  - Result: pass
  - Summary: `8 pass, 0 fail`
- `bun typecheck`
  - Result: pass
  - Output: `$ tsgo --noEmit`
