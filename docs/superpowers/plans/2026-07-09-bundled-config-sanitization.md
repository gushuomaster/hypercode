# Bundled Config Sanitization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the started bundled-config sync prototype into a commit-safe follow-up change by replacing the local-only bundled config with a sanitized public default, seeding it only for first-time installs, and proving it with focused config tests.

**Architecture:** Keep the `config.ts` sync path that seeds `opencode.json` from `bundledHypercodeConfig`, but make that seed non-destructive so it runs only when the target file does not already exist. Verify safety first with a failing test, then replace the bundled JSON string with a public provider template, then lock in the non-overwrite behavior with focused config tests before updating the existing branch and PR.

**Tech Stack:** TypeScript, Bun, Effect, PowerShell, Git

## Global Constraints

- Modify only `packages/opencode/src/config/hypercode-bundled.ts`, `packages/opencode/src/config/config.ts`, and `packages/opencode/test/config/config.test.ts` for this scope.
- `hypercode-bundled.ts` must contain no secrets or machine-specific paths.
- The bundled default must keep `"$schema"`, `model`, `small_model`, one `provider` entry for `minimax-direct`, and an `apiKey` placeholder in `{env:MINIMAX_API_KEY}` form.
- The bundled default must not contain `plugin`, `mcp`, local command arrays, raw API keys, `D:/...`, or `C:\\...` absolute paths.
- Keep the existing sync behavior: skip bundled sync in tests unless `OPENCODE_FORCE_BUNDLED_GLOBAL_CONFIG_SYNC=1`.
- Bundled sync must seed first-install defaults only; it must not overwrite an existing user-managed `opencode.json`.
- Run verification from `packages/opencode`; do not run tests from the repo root.
- Use `bun typecheck` from `packages/opencode` for type verification.
- Use a conventional commit message for the follow-up commit on `license-guides`.

---

### Task 1: Add Safety Regression Coverage And Sanitize The Bundled Template

**Files:**
- Modify: `packages/opencode/test/config/config.test.ts`
- Modify: `packages/opencode/src/config/hypercode-bundled.ts`

**Interfaces:**
- Consumes: `bundledHypercodeConfig: string`
- Produces: `test("bundled HyperCode config stays repository-safe", ...)`
- Produces: `bundledHypercodeConfig: string` containing only schema, public model defaults, one `minimax-direct` provider, and an env-token `apiKey`

- [ ] **Step 1: Add the failing repository-safety regression test**

```ts
test("bundled HyperCode config stays repository-safe", () => {
  expect(bundledHypercodeConfig).toContain('"$schema": "https://opencode.ai/config.json"')
  expect(bundledHypercodeConfig).toContain('"model": "minimax-direct/MiniMax-M2.7"')
  expect(bundledHypercodeConfig).toContain('"small_model": "minimax-direct/MiniMax-M2.7"')
  expect(bundledHypercodeConfig).toContain('"apiKey": "{env:MINIMAX_API_KEY}"')
  expect(bundledHypercodeConfig).not.toContain('"plugin"')
  expect(bundledHypercodeConfig).not.toContain('"mcp"')
  expect(bundledHypercodeConfig).not.toContain("D:/")
  expect(bundledHypercodeConfig).not.toContain("C:\\\\")
  expect(bundledHypercodeConfig).not.toContain("sk-")
})
```

- [ ] **Step 2: Run the focused test and confirm it fails for the unsafe local bundle**

Run: `bun test --timeout 30000 test/config/config.test.ts -t "repository-safe"`

Run from: `packages/opencode`

Expected:
- FAIL because the current bundled string still contains local-only content such as `D:/tools`, `C:\\Users\\...`, `"plugin"`, `"mcp"`, or a raw `sk-...` key.

- [ ] **Step 3: Replace the bundled config string with a commit-safe public template**

```ts
export const bundledHypercodeConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "minimax-direct/MiniMax-M2.7",
  "small_model": "minimax-direct/MiniMax-M2.7",
  "provider": {
    "minimax-direct": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiniMax (直连)",
      "options": {
        "baseURL": "https://api.minimaxi.com/v1",
        "apiKey": "{env:MINIMAX_API_KEY}"
      },
      "models": {
        "MiniMax-M2.7": {
          "name": "MiniMax M2.7"
        },
        "MiniMax-M2.7-highspeed": {
          "name": "MiniMax M2.7 (highspeed)"
        }
      }
    }
  }
}`
```

Expected:
- The file contains only public product defaults.
- No `plugin`, `mcp`, machine-local paths, or raw credentials remain in the exported string.

- [ ] **Step 4: Rerun the focused repository-safety test**

Run: `bun test --timeout 30000 test/config/config.test.ts -t "repository-safe"`

Run from: `packages/opencode`

Expected:
- PASS

### Task 2: Re-verify Sync Behavior, Typecheck, And Update The Existing Branch

**Files:**
- Review: `packages/opencode/src/config/config.ts`
- Review: `packages/opencode/src/config/hypercode-bundled.ts`
- Review: `packages/opencode/test/config/config.test.ts`

**Interfaces:**
- Consumes: `shouldSyncBundledGlobalConfig(): boolean`
- Consumes: `syncBundledGlobalConfig(): Effect.Effect<void, never, FSUtil.Service>`
- Produces: a verified follow-up commit on `license-guides`
- Produces: an updated remote branch `origin/license-guides` and refreshed PR diff

- [ ] **Step 1: Confirm the sync helper still gates bundled writes only when allowed**

```ts
function shouldSyncBundledGlobalConfig() {
  if (process.env.OPENCODE_TEST_HOME && process.env.OPENCODE_FORCE_BUNDLED_GLOBAL_CONFIG_SYNC !== "1") return false
  return !Flag.OPENCODE_CONFIG && !Flag.OPENCODE_CONFIG_DIR && !Flag.OPENCODE_CONFIG_CONTENT
}

const syncBundledGlobalConfig = Effect.fnUntraced(function* () {
  if (!shouldSyncBundledGlobalConfig()) return
  const file = path.join(Global.Path.config, "opencode.json")
  const current = yield* fs.readFileStringSafe(file)
  if (current) return
  yield* fs.writeWithDirs(file, bundledHypercodeConfig).pipe(Effect.catch(() => Effect.void))
})
```

Expected:
- No new behavior is added here beyond the started sync prototype.
- The helper still respects test isolation and env-based config overrides.
- Existing user config is preserved because bundled sync only seeds when `opencode.json` is absent.

- [ ] **Step 2: Run the full focused config verification**

Run: `bun test --timeout 30000 test/config/config.test.ts`

Run from: `packages/opencode`

Expected:
- PASS
- The existing bundled-sync tests still verify create behavior for `opencode.json` and preserve existing user-managed content.

- [ ] **Step 3: Run package-local type verification**

Run: `bun typecheck`

Run from: `packages/opencode`

Expected:
- PASS

- [ ] **Step 4: Review the final diff before committing**

```powershell
git diff --stat -- packages/opencode/src/config/config.ts packages/opencode/src/config/hypercode-bundled.ts packages/opencode/test/config/config.test.ts
git diff -- packages/opencode/src/config/config.ts packages/opencode/src/config/hypercode-bundled.ts packages/opencode/test/config/config.test.ts
```

Expected:
- Only the three config-related files appear.
- The bundle string is now public and environment-agnostic.
- No unrelated docs, tools, or local helper files appear in the patch.

- [ ] **Step 5: Commit the sanitized config follow-up**

```powershell
git add packages/opencode/src/config/config.ts
git add packages/opencode/src/config/hypercode-bundled.ts
git add packages/opencode/test/config/config.test.ts
git commit -m "fix(opencode): sanitize bundled global config"
```

Expected:
- One focused commit captures the safe bundled-config sync change.

- [ ] **Step 6: Push the branch update to refresh the existing PR**

```powershell
git push
```

Expected:
- `origin/license-guides` updates in place.
- The existing PR on that branch shows the sanitized follow-up commit instead of local-only config content.
