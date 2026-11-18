import { describe, expect, test } from "bun:test"
import { shouldEnforceLicenseGate } from "../../src/cli/cmd/license"

describe("license gate", () => {
  test("enforces the gate for normal startup by default", () => {
    const env = { NODE_ENV: "production" }
    expect(shouldEnforceLicenseGate([], env)).toBe(true)
    expect(shouldEnforceLicenseGate(["run"], env)).toBe(true)
    expect(shouldEnforceLicenseGate(["serve"], env)).toBe(true)
  })

  test("skips the gate for code generation commands", () => {
    expect(shouldEnforceLicenseGate(["generate"], { NODE_ENV: "production" })).toBe(false)
  })

  test("skips the gate for help, version, completion, and license tools", () => {
    const env = { NODE_ENV: "production" }
    expect(shouldEnforceLicenseGate(["--help"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["-h"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["--version"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["-v"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["help"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["completion"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["license"], env)).toBe(false)
    expect(shouldEnforceLicenseGate(["license", "status"], env)).toBe(false)
  })

  test("skips the gate in test execution contexts", () => {
    expect(shouldEnforceLicenseGate(["run"], { NODE_ENV: "test" })).toBe(false)
    expect(shouldEnforceLicenseGate(["run"], { NODE_ENV: "production", OPENCODE_TEST_HOME: "/tmp/opencode-test-home" })).toBe(false)
  })
})

describe("license gate entrypoint", () => {
  // Guards against upstream syncs that rewrite the CLI entrypoint and drop the gate.
  test("main.ts enforces the gate in the global middleware before any command runs", async () => {
    const source = await Bun.file(new URL("../../src/cli/main.ts", import.meta.url)).text()
    const middleware = source.slice(source.indexOf(".middleware("), source.indexOf(".command("))
    expect(source).toContain('import { LicenseCommand, enforceLicenseGate } from "./cmd/license"')
    expect(middleware).toContain("await enforceLicenseGate(args)")
    expect(source).toContain(".command(localizeCommand(LicenseCommand))")
  })

  test("keeps mcp and auth behind the gate", () => {
    const env = { NODE_ENV: "production" }
    expect(shouldEnforceLicenseGate(["mcp", "list"], env)).toBe(true)
    expect(shouldEnforceLicenseGate(["auth", "login"], env)).toBe(true)
  })
})
