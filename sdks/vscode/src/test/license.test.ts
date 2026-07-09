import assert from "node:assert/strict"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { describe, test } from "node:test"

import { generateExpectedLicense, validateLicenseKey } from "../license/licenseAlgorithm"
import { getMachineId } from "../license/machineId"
import { resolveLicensePath } from "../license/licensePaths"
import { validateLicense } from "../license/licenseValidator"

const machine = "BFEBFBFF000B0671"

describe("license algorithm", () => {
  test("permanent license is bound to the machine id", () => {
    const key = generateExpectedLicense(machine)
    assert.equal(validateLicenseKey(key, machine).valid, true)
    assert.equal(validateLicenseKey(key, "OTHER").valid, false)
  })

  test("expired timed license is rejected", () => {
    const key = generateExpectedLicense(machine, new Date("2000-01-01T00:00:00"))
    const result = validateLicenseKey(key, machine)
    assert.equal(result.valid, false)
    assert.equal(result.reason, "expired")
  })
})

describe("license paths", () => {
  test("uses fixed Windows path", () => {
    assert.equal(resolveLicensePath({ platform: "win32" }), "C:\\hyper-aicode\\license.txt")
  })
})

describe("machine id", () => {
  test("falls back to PowerShell when wmic is unavailable on Windows", async () => {
    const seen: string[] = []
    const id = await getMachineId({
      platform: "win32",
      run: async (command) => {
        seen.push(command)
        if (command === "wmic cpu get processorid") {
          throw new Error("spawn wmic ENOENT")
        }
        if (command.includes("Get-CimInstance Win32_Processor")) {
          return "BFEBFBFF000B0671\r\n"
        }
        throw new Error(`unexpected command: ${command}`)
      },
    })

    assert.equal(id, machine)
    assert.deepEqual(seen, [
      "wmic cpu get processorid",
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId).Trim()"',
    ])
  })
})

describe("license validator", () => {
  async function withTmp(run: (file: string) => Promise<void>) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hc-license-"))
    const file = path.join(dir, "license.txt")
    try {
      await run(file)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }

  test("missing file reports missing", async () => {
    await withTmp(async (file) => {
      const result = await validateLicense({ licensePath: file })
      assert.equal(result.ok, false)
      assert.equal(result.ok === false && result.reason, "missing")
    })
  })

  test("default validation rejects invalid key but accepts a signed one", async () => {
    await withTmp(async (file) => {
      await fs.writeFile(file, "garbage")
      const bad = await validateLicense({ licensePath: file, machineId: machine })
      assert.equal(bad.ok, false)

      await fs.writeFile(file, generateExpectedLicense(machine))
      const good = await validateLicense({ licensePath: file, machineId: machine })
      assert.equal(good.ok, true)
    })
  })
})
