import { describe, expect, test } from "bun:test"
import path from "path"
import * as License from "../../src/license/license"
import { tmpdir } from "../fixture/fixture"

describe("license", () => {
  test("parses Windows processor ID output", () => {
    expect(License.parseWindowsMachineID("ProcessorId\r\nBFEBFBFF000B0671\r\n\r\n")).toBe("BFEBFBFF000B0671")
  })

  test("reports missing, empty, and valid license files", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "license.txt")

    expect((await License.validateFile({ platform: "win32", path: file })).status).toBe("missing")

    await Bun.write(file, "")
    expect((await License.validateFile({ platform: "win32", path: file })).status).toBe("empty")

    await Bun.write(file, "not-a-license")
    expect((await License.validateFile({ platform: "win32", path: file })).status).toBe("valid")
  })

  test("uses Windows and Linux license paths", () => {
    expect(License.licensePath("win32")).toBe("C:\\hyper-aicode\\license.txt")
    expect(License.licensePath("linux", "/home/hyper")).toBe("/home/hyper/hyper-aicode/license.txt")
  })

  const machine = "BFEBFBFF000B0671"

  test("validates a permanent license bound to the machine id", () => {
    const key = License.generateExpectedLicense(machine)
    expect(License.validateLicenseKey(key, machine).valid).toBe(true)
    expect(License.validateLicenseKey(key, "OTHER-MACHINE").valid).toBe(false)
  })

  test("rejects a tampered license", () => {
    const key = License.generateExpectedLicense(machine).slice(0, -1) + "0"
    expect(License.validateLicenseKey(key, machine).valid).toBe(false)
  })

  test("validates timed licenses and detects expiry", () => {
    const future = new Date("2999-01-01T00:00:00")
    const past = new Date("2000-01-01T00:00:00")

    const goodKey = License.generateExpectedLicense(machine, future)
    expect(License.validateLicenseKey(goodKey, machine).valid).toBe(true)

    const expiredKey = License.generateExpectedLicense(machine, past)
    const result = License.validateLicenseKey(expiredKey, machine)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe("expired")
  })
})
