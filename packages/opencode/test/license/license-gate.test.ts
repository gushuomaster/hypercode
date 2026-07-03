import { describe, expect, test } from "bun:test"
import { shouldEnforceLicenseGate } from "../../src/cli/cmd/license"

describe("license gate", () => {
  test("enforces the gate for normal startup by default", () => {
    expect(shouldEnforceLicenseGate([])).toBe(true)
    expect(shouldEnforceLicenseGate(["run"])).toBe(true)
    expect(shouldEnforceLicenseGate(["serve"])).toBe(true)
  })

  test("skips the gate for help, version, completion, and license tools", () => {
    expect(shouldEnforceLicenseGate(["--help"])).toBe(false)
    expect(shouldEnforceLicenseGate(["-h"])).toBe(false)
    expect(shouldEnforceLicenseGate(["--version"])).toBe(false)
    expect(shouldEnforceLicenseGate(["-v"])).toBe(false)
    expect(shouldEnforceLicenseGate(["help"])).toBe(false)
    expect(shouldEnforceLicenseGate(["completion"])).toBe(false)
    expect(shouldEnforceLicenseGate(["license"])).toBe(false)
    expect(shouldEnforceLicenseGate(["license", "status"])).toBe(false)
  })
})
