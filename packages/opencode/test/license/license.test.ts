import { describe, expect, test } from "bun:test"
import path from "path"
import {
  fingerprint,
  licensePath,
  normalizeMachineID,
  parseWindowsMachineGuid,
  validate,
  verifyLicense,
} from "../../src/license/license"
import { publicKeys } from "../../src/license/public-key"
import { formatResult } from "../../src/cli/cmd/license"
import { generateKeyPair, signLicense } from "../../script/license/sign"
import { tmpdir } from "../fixture/fixture"

// Test-only key pair generated per run; production keys are never available to tests.
const pair = generateKeyPair()
const keys = [{ kid: pair.kid, spki: pair.spki }]
const machine = fingerprint("linux", "0123456789abcdef0123456789abcdef")
const issue = (input: { machineID?: string; exp?: string; kid?: string } = {}) =>
  signLicense(pair.privateKeyPem, { kid: input.kid ?? pair.kid, machineID: input.machineID ?? machine, exp: input.exp })

describe("license v2", () => {
  test("accepts a permanent license for the bound machine", () => {
    const result = verifyLicense(issue(), { machineID: machine, publicKeys: keys })
    expect(result.status).toBe("valid")
    expect(result.expires).toBeUndefined()
  })

  test("rejects a license for another machine", () => {
    const other = fingerprint("linux", "fedcba9876543210fedcba9876543210")
    expect(verifyLicense(issue(), { machineID: other, publicKeys: keys }).status).toBe("machine_mismatch")
  })

  test("rejects a tampered payload", () => {
    const [head, , signature] = issue().split(".")
    const forged = Buffer.from(
      JSON.stringify({ v: 2, kid: pair.kid, mid: fingerprint("linux", "other"), iat: "2026-11-12" }),
    ).toString("base64url")
    expect(verifyLicense(`${head}.${forged}.${signature}`, { machineID: machine, publicKeys: keys }).status).toBe(
      "bad_signature",
    )
  })

  test("rejects licenses signed by an unknown or untrusted key", () => {
    expect(verifyLicense(issue({ kid: "unknown" }), { machineID: machine, publicKeys: keys }).status).toBe(
      "bad_signature",
    )
    const stranger = generateKeyPair()
    const foreign = signLicense(stranger.privateKeyPem, { kid: pair.kid, machineID: machine })
    expect(verifyLicense(foreign, { machineID: machine, publicKeys: keys }).status).toBe("bad_signature")
  })

  test("treats the expiry day as valid and the next day as expired", () => {
    const license = issue({ exp: "2026-12-31" })
    const at = (value: string) => verifyLicense(license, { machineID: machine, publicKeys: keys, now: new Date(value) })
    expect(at("2026-12-31T23:59:00").status).toBe("valid")
    expect(at("2026-12-31T23:59:00").expires).toBe("2026-12-31")
    expect(at("2027-01-01T00:00:01").status).toBe("expired")
  })

  test("reports retired legacy licenses distinctly", () => {
    const legacy = "0a1b-2c3d-4e5f-6a7b-8c9d-0e1f-2a3b-4c5d-123"
    expect(verifyLicense(legacy, { machineID: machine, publicKeys: keys }).status).toBe("legacy_format")
    expect(verifyLicense(`${legacy}-20991231`, { machineID: machine, publicKeys: keys }).status).toBe("legacy_format")
    expect(verifyLicense(`${legacy}|EXP=2099-12-31`, { machineID: machine, publicKeys: keys }).status).toBe(
      "legacy_format",
    )
  })

  test("reports malformed content", () => {
    for (const text of ["not-a-license", "HCL2.abc", "HCL2.e30.abc", `HCL1.${issue().slice(5)}`]) {
      expect(verifyLicense(text, { machineID: machine, publicKeys: keys }).status).toBe("malformed")
    }
  })

  test("ships only production verification keys", () => {
    expect(publicKeys.length).toBeGreaterThan(0)
    expect(publicKeys.some((key) => key.spki === pair.spki)).toBe(false)
  })
})

describe("machine id", () => {
  test("parses MachineGuid from reg query output", () => {
    const output = [
      "",
      "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
      "    MachineGuid    REG_SZ    3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      "",
    ].join("\r\n")
    expect(parseWindowsMachineGuid(output)).toBe("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
    expect(parseWindowsMachineGuid("ERROR: The system was unable to find the specified registry key")).toBeUndefined()
  })

  test("derives distinct, normalized fingerprints per platform and source id", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    expect(fingerprint("win32", id)).toMatch(/^([0-9a-f]{4}-){7}[0-9a-f]{4}$/)
    expect(fingerprint("win32", id)).toBe(fingerprint("win32", ` ${id.toUpperCase()} `))
    expect(fingerprint("win32", id)).not.toBe(fingerprint("linux", id))
    expect(fingerprint("win32", id)).not.toBe(fingerprint("win32", "3f2504e0-4f89-11d3-9a0c-0305e82c3302"))
  })

  test("normalizes machine ids typed with different separators or case", () => {
    expect(normalizeMachineID(machine.toUpperCase().replaceAll("-", " "))).toBe(machine)
    expect(normalizeMachineID("too-short")).toBeUndefined()
  })
})

describe("license file", () => {
  const options = (file: string) => ({ platform: "linux" as const, path: file, publicKeys: keys, machineID: async () => machine })

  test("reports missing, empty, valid, and machine id failures", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "license.txt")

    expect((await validate(options(file))).status).toBe("missing")
    await Bun.write(file, "  \n")
    expect((await validate(options(file))).status).toBe("empty")
    await Bun.write(file, issue() + "\n")
    expect((await validate(options(file))).status).toBe("valid")
    const failing = await validate({ ...options(file), machineID: () => Promise.reject(new Error("no id")) })
    expect(failing).toMatchObject({ status: "machine_id_error", message: "no id" })
  })

  test("reports unsupported platforms before touching the file", async () => {
    expect((await validate({ platform: "darwin", path: "/nonexistent/license.txt" })).status).toBe(
      "unsupported_platform",
    )
  })

  test("uses Windows and Linux license paths", () => {
    expect(licensePath("win32")).toBe("C:\\hyper-aicode\\license.txt")
    expect(licensePath("linux", "/home/hyper")).toBe("/home/hyper/hyper-aicode/license.txt")
  })
})

describe("license messages", () => {
  test("explains legacy licenses in Chinese with the re-issue step", () => {
    const message = formatResult({ status: "legacy_format", path: "/home/hyper/hyper-aicode/license.txt" }, "zh")
    expect(message).toContain("旧格式")
    expect(message).toContain("hypercode license machine-id")
    expect(message).toContain("/home/hyper/hyper-aicode/license.txt")
  })

  test("states the delivery scope on unsupported platforms", () => {
    const message = formatResult({ status: "unsupported_platform", path: "/Users/a/hyper-aicode/license.txt" }, "zh")
    expect(message).toContain("不在 HyperCode 交付范围")
    expect(message).toContain("Windows 与 Linux")
    expect(message).not.toContain("授权文件：")
  })

  test("shows expiry for valid licenses", () => {
    expect(formatResult({ status: "valid", path: "/x", expires: "2026-12-31" }, "zh")).toContain("2026-12-31")
    expect(formatResult({ status: "valid", path: "/x" }, "en")).toContain("permanent")
  })
})
