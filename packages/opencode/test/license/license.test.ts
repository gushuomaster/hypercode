import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "path"
import * as fs from "fs/promises"
import * as License from "../../src/license/license"
import { tmpdir } from "../fixture/fixture"

const require = createRequire(import.meta.url)

describe("license", () => {
  test("parses Windows processor ID output", () => {
    expect(License.parseWindowsMachineID("ProcessorId\r\nBFEBFBFF000B0671\r\n\r\n")).toBe("BFEBFBFF000B0671")
  })

  test.if(process.platform === "win32")("falls back to PowerShell when wmic is unavailable on Windows", async () => {
    await using tmp = await tmpdir()
    const originalPath = process.env.PATH
    const powershell = path.join(tmp.path, "powershell.cmd")

    await fs.writeFile(powershell, "@echo off\r\necho BFEBFBFF000B0671\r\n")
    process.env.PATH = tmp.path

    try {
      const id = await License.machineID("win32")
      expect(id).toBe("BFEBFBFF000B0671")
    } finally {
      process.env.PATH = originalPath
    }
  })

  test("license generator falls back to PowerShell when wmic is unavailable on Windows", async () => {
    await using tmp = await tmpdir()
    const originalPath = process.env.PATH
    const powershell = path.join(tmp.path, "powershell.cmd")
    await fs.writeFile(powershell, "@echo off\r\necho BFEBFBFF000B0671\r\n")
    process.env.PATH = tmp.path
    const modulePath = require.resolve("../../script/license/licenseGenerator.cjs")
    delete require.cache[modulePath]
    const { LicenseGenerator } = require(modulePath)

    try {
      const id = await new LicenseGenerator().getSystemId()
      expect(id).toBe("BFEBFBFF000B0671")
    } finally {
      process.env.PATH = originalPath
      delete require.cache[modulePath]
    }
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
