## 2026-07-09 final whole-branch review fixes

### Fix details

- Extended bundled global-config first-install detection in `packages/opencode/src/config/config.ts` so `hasExistingGlobalConfigFile()` also treats the legacy global `config` file as an existing source. This prevents bundled `opencode.json` seeding before legacy migration/merge runs.
- Updated `shouldSyncBundledGlobalConfig()` to respect runtime environment redirection in addition to module-load-captured flags by checking `process.env.OPENCODE_CONFIG`, `process.env.OPENCODE_CONFIG_DIR`, and `process.env.OPENCODE_CONFIG_CONTENT`.
- Added regression coverage in `packages/opencode/test/config/config.test.ts` for:
  - legacy `config` present -> no bundled `opencode.json` seed
  - `OPENCODE_CONFIG` set -> no bundled `opencode.json` seed
  - `OPENCODE_CONFIG_CONTENT` set -> no bundled `opencode.json` seed

### Verification

- `bun test --timeout 30000 test/config/config.test.ts`
  - Result: pass
  - Summary: `101 pass, 0 fail`
- `bun typecheck`
  - Result: pass
  - Command output: `$ tsgo --noEmit`
