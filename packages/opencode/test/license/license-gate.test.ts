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
