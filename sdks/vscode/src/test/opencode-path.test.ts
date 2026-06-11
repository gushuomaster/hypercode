import "./preload-vscode"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, test } from "node:test"
import * as vscode from "vscode"
import { getCliPath, getOpencodePath } from "../core/settings"
import { resolveOpencodeCommand, shouldUseShell } from "../core/server"
import { checkOpencodeAvailable, isMissingOpencodeError } from "../core/runtime-errors"

const originalGetConfiguration = vscode.workspace.getConfiguration

afterEach(() => {
  ;(vscode.workspace as typeof vscode.workspace & {
    getConfiguration: typeof vscode.workspace.getConfiguration
  }).getConfiguration = originalGetConfiguration
})

function stubConfig(map: Record<string, unknown>) {
  ;(vscode.workspace as typeof vscode.workspace & {
    getConfiguration: typeof vscode.workspace.getConfiguration
  }).getConfiguration = ((section?: string) => ({
    get: <T,>(key: string, fallback: T) => {
      if (section === "hypercode" && key in map) {
        return map[key] as T
      }
      return fallback
    },
  })) as typeof vscode.workspace.getConfiguration
}

describe("hypercode cli path setting", () => {
  test("returns empty string when nothing is configured", () => {
    stubConfig({})
    assert.equal(getCliPath(), "")
    assert.equal(getOpencodePath(), "")
  })

  test("prefers hypercode.cliPath when configured", () => {
    stubConfig({
      cliPath: "C:/tools/hypercode/hypercode.exe",
      opencodePath: "C:/tools/opencode/opencode.exe",
    })
    assert.equal(getCliPath(), "C:/tools/hypercode/hypercode.exe")
    assert.equal(getOpencodePath(), "C:/tools/hypercode/hypercode.exe")
  })

  test("accepts the legacy opencodePath value as a fallback", () => {
    stubConfig({ opencodePath: "C:/tools/opencode/opencode.exe" })
    assert.equal(getCliPath(), "C:/tools/opencode/opencode.exe")
    assert.equal(getOpencodePath(), "C:/tools/opencode/opencode.exe")
  })

  test("trims surrounding whitespace from the configured path", () => {
    stubConfig({ cliPath: "  /usr/local/bin/hypercode  " })
    assert.equal(getCliPath(), "/usr/local/bin/hypercode")
    assert.equal(getOpencodePath(), "/usr/local/bin/hypercode")
  })

  test("strips matching quotes from the configured path", () => {
    stubConfig({ cliPath: '  "C:/Program Files/HyperCode/hypercode.exe"  ' })
    assert.equal(getCliPath(), "C:/Program Files/HyperCode/hypercode.exe")
    assert.equal(getOpencodePath(), "C:/Program Files/HyperCode/hypercode.exe")
  })

  test("trims surrounding whitespace from the legacy fallback path", () => {
    stubConfig({ opencodePath: "  /usr/local/bin/opencode  " })
    assert.equal(getCliPath(), "/usr/local/bin/opencode")
    assert.equal(getOpencodePath(), "/usr/local/bin/opencode")
  })

  test("auto-detects a runtime when no path is configured", () => {
    assert.match(resolveOpencodeCommand(""), /^(hypercode|opencode)$/)
  })

  test("auto-detects a runtime when the configured path is whitespace only", () => {
    assert.match(resolveOpencodeCommand("   "), /^(hypercode|opencode)$/)
  })

  test("uses the configured path when provided", () => {
    assert.equal(resolveOpencodeCommand("/usr/local/bin/hypercode"), "/usr/local/bin/hypercode")
    assert.equal(resolveOpencodeCommand("C:/tools/hypercode.exe"), "C:/tools/hypercode.exe")
    assert.equal(resolveOpencodeCommand("/usr/local/bin/opencode"), "/usr/local/bin/opencode")
    assert.equal(resolveOpencodeCommand("C:/tools/opencode.exe"), "C:/tools/opencode.exe")
  })

  test("classifies missing-runtime errors regardless of which compatible binary path is referenced", () => {
    assert.equal(
      isMissingOpencodeError(
        'failed to start HyperCode runtime: command "C:/tools/hypercode.exe" was not found on the current host PATH (configured via "hypercode.cliPath": C:/tools/hypercode.exe)',
      ),
      true,
    )
    assert.equal(
      isMissingOpencodeError(
        'failed to start HyperCode runtime: command "hypercode" was not found on the current host PATH (set "hypercode.cliPath" to point at the HyperCode runtime if it lives outside PATH)',
      ),
      true,
    )
    assert.equal(
      isMissingOpencodeError(
        'failed to start opencode: command "opencode" was not found on the current host PATH (configured via "hypercode.cliPath": /usr/local/bin/opencode)',
      ),
      true,
    )
    assert.equal(
      isMissingOpencodeError(
        'failed to start HyperCode runtime: command "/usr/local/bin/hypercode" is not executable on the current host (configured via "hypercode.cliPath": /usr/local/bin/hypercode)',
      ),
      true,
    )
    assert.equal(isMissingOpencodeError("server exited before ready (code=1 signal=none)"), false)
  })

  test("checkOpencodeAvailable uses the configured cliPath", async () => {
    const bogus = process.platform === "win32"
      ? "C:/this/path/definitely/does/not/exist/hypercode.exe"
      : "/this/path/definitely/does/not/exist/hypercode"
    stubConfig({ cliPath: bogus })

    const result = await checkOpencodeAvailable()
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.message.length > 0, "error message should not be empty")
    }
  })

  test("checkOpencodeAvailable still accepts the legacy opencodePath", async () => {
    const bogus = process.platform === "win32"
      ? "C:/this/path/definitely/does/not/exist/opencode.exe"
      : "/this/path/definitely/does/not/exist/opencode"
    stubConfig({ opencodePath: bogus })

    const result = await checkOpencodeAvailable()
    assert.equal(result.ok, false)
    if (!result.ok) {
      // Either ENOENT, a spawn error, or a shell-level "not found" message (which on
      // Windows may be a localized string from cmd.exe).  The key assertion is result.ok === false.
      assert.ok(result.message.length > 0, "error message should not be empty")
    }
  })

  test("shouldUseShell keeps shell execution for bare commands and cmd wrappers on Windows", () => {
    if (process.platform !== "win32") {
      assert.equal(shouldUseShell("hypercode"), false)
      return
    }

    assert.equal(shouldUseShell("hypercode"), true)
    assert.equal(shouldUseShell("hypercode.cmd"), true)
    assert.equal(shouldUseShell("C:/tools/hypercode.cmd"), true)
  })

  test("shouldUseShell skips shell execution for explicit executable paths on Windows", () => {
    if (process.platform !== "win32") {
      assert.equal(shouldUseShell("/usr/local/bin/hypercode"), false)
      return
    }

    assert.equal(shouldUseShell("C:/Program Files/HyperCode/hypercode.exe"), false)
    assert.equal(shouldUseShell("C:/tools/hypercode.exe"), false)
    assert.equal(shouldUseShell("hypercode.exe"), false)
  })

  test("runtime errors check shares the same shell strategy", () => {
    const source = readFileSync(resolve(process.cwd(), "src/core/runtime-errors.ts"), "utf8")
    assert.match(source, /shell:\s*shouldUseShell\(command\)/)
  })

  test("declares hypercode.cliPath in the extension configuration", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      contributes?: {
        configuration?: {
          properties?: Record<string, {
            type?: string
            default?: string
            scope?: string
          }>
        }
      }
    }

    const prop = pkg.contributes?.configuration?.properties?.["hypercode.cliPath"]
    assert.ok(prop, "hypercode.cliPath should be declared in package.json")
    assert.equal(prop?.type, "string")
    assert.equal(prop?.default, "")
    assert.equal(prop?.scope, "machine-overridable")
  })

  test("does not expose the legacy opencodePath setting in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      contributes?: {
        configuration?: {
          properties?: Record<string, unknown>
        }
      }
    }

    assert.equal(pkg.contributes?.configuration?.properties?.["hypercode.opencodePath"], undefined)
  })
})
