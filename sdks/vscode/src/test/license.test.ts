import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type * as vscode from "vscode"

import { localizedLicenseMessage } from "../license/licenseCommands"
import { parseLicenseStatus, queryLicense, type CliRun } from "../license/licenseStatus"
import { WorkspaceManager } from "../core/workspace"
import { isMissingOpencodeError } from "../core/runtime-errors"
import { setLocale } from "../i18n"

const licensePath = "/home/hyper/hyper-aicode/license.txt"
const cli = (stdout: string, code = 0): CliRun => async () => ({ code, stdout, stderr: "" })
const json = (status: string) => JSON.stringify({ ok: status === "valid", status, path: licensePath, expires: null, message: null })

describe("license status from CLI", () => {
  test("parses the JSON payload printed by `license status --json`", async () => {
    assert.deepEqual(await queryLicense(cli(`log line\n${json("legacy_format")}\n`)), {
      ok: false,
      status: "legacy_format",
      path: licensePath,
      expires: null,
      message: null,
    })
    assert.equal((await queryLicense(cli(json("valid")))).ok, true)
  })

  test("never treats an unusable CLI as licensed", async () => {
    assert.equal((await queryLicense(cli("not json"))).status, "cli_unavailable")
    assert.equal((await queryLicense(cli(json("valid"), 1))).status, "cli_unavailable")
    assert.equal(parseLicenseStatus(JSON.stringify({ ok: true, status: "expired", path: licensePath }))?.ok, false)
    const missing = await queryLicense(async () => {
      throw new Error('command "hypercode" was not found on the current host PATH')
    })
    assert.equal(missing.status, "cli_unavailable")
    assert.equal(isMissingOpencodeError(missing.message ?? ""), true)
  })

  test("localizes every CLI status code", () => {
    setLocale("zh")
    const codes = [
      "missing",
      "empty",
      "read_error",
      "malformed",
      "legacy_format",
      "bad_signature",
      "machine_mismatch",
      "expired",
      "unsupported_platform",
      "machine_id_error",
    ]
    for (const status of codes) {
      const message = localizedLicenseMessage({ ok: false, status, path: licensePath, expires: null, message: null })
      assert.notEqual(message, status, status)
      assert.match(message, /[一-鿿]/, status)
    }
    assert.match(
      localizedLicenseMessage({ ok: false, status: "legacy_format", path: licensePath, expires: null, message: null }),
      /旧格式.*hypercode license machine-id/,
    )
    assert.match(
      localizedLicenseMessage({ ok: false, status: "unsupported_platform", path: licensePath, expires: null, message: null }),
      /不在 HyperCode 交付范围/,
    )
  })
})

describe("workspace license gate", () => {
  const folder = { uri: { toString: () => "file:///repo", fsPath: "/repo" }, name: "repo", index: 0 } as unknown as vscode.WorkspaceFolder
  const out = { appendLine() {} } as unknown as vscode.OutputChannel

  test("blocks the runtime and offers license actions when the CLI reports an invalid license", async () => {
    setLocale("zh")
    const prompts: string[] = []
    let spawned = false
    const manager = new WorkspaceManager(out, {
      queryLicense: async () => ({ ok: false, status: "machine_mismatch", path: licensePath, expires: null, message: null }),
      promptForLicenseIssue: async (message) => {
        prompts.push(message)
        return undefined
      },
      spawn: () => {
        spawned = true
        throw new Error("must not spawn")
      },
    })
    const rt = await manager.ensure(folder)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(rt?.state, "error")
    assert.equal(spawned, false)
    assert.equal(prompts.length, 1)
    assert.match(prompts[0], /授权不属于这台设备/)
  })

  test("reports an unusable CLI as a runtime failure without license prompts", async () => {
    let prompted = false
    const manager = new WorkspaceManager(out, {
      queryLicense: async () => ({
        ok: false,
        status: "cli_unavailable",
        message: 'command "hypercode" was not found on the current host PATH',
      }),
      promptForLicenseIssue: async () => {
        prompted = true
        return undefined
      },
    })
    const rt = await manager.ensure(folder)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(rt?.state, "error")
    assert.equal(isMissingOpencodeError(rt?.err), true)
    assert.equal(prompted, false)
  })
})
