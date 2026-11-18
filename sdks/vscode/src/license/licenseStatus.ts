import * as cp from "node:child_process"
import { resolveOpencodeCommand, shouldUseShell } from "../core/server"
import { getCliPath } from "../core/settings"

// Status codes are defined by the CLI (`hypercode license status --json`); the extension only renders them.
export type LicenseStatusCode =
  | "valid"
  | "missing"
  | "empty"
  | "read_error"
  | "malformed"
  | "legacy_format"
  | "bad_signature"
  | "machine_mismatch"
  | "expired"
  | "unsupported_platform"
  | "machine_id_error"

export type LicenseStatus = {
  ok: boolean
  status: LicenseStatusCode | (string & {})
  path: string
  expires: string | null
  message: string | null
}

export type LicenseQuery = LicenseStatus | { ok: false; status: "cli_unavailable"; message: string }

export type CliRun = (args: string[]) => Promise<{ code: number | null; stdout: string; stderr: string }>

export async function queryLicense(run: CliRun = runCli): Promise<LicenseQuery> {
  const result = await run(["license", "status", "--json"]).catch((error: unknown) => ({
    code: null,
    stdout: "",
    stderr: error instanceof Error ? error.message : String(error),
  }))
  const status = result.code === 0 ? parseLicenseStatus(result.stdout) : undefined
  if (status) return status
  return {
    ok: false,
    status: "cli_unavailable",
    message: result.stderr.trim() || result.stdout.trim() || `license status exited with code ${result.code ?? "unknown"}`,
  }
}

export function parseLicenseStatus(stdout: string): LicenseStatus | undefined {
  // The CLI may print log lines before the JSON payload; the payload is the last line.
  const line = stdout.trim().split(/\r?\n/).at(-1)
  if (!line) return undefined
  const value = (() => {
    try {
      return JSON.parse(line) as unknown
    } catch {
      return undefined
    }
  })()
  if (!value || typeof value !== "object") return undefined
  const item = value as Record<string, unknown>
  if (typeof item.ok !== "boolean" || typeof item.status !== "string" || typeof item.path !== "string") return undefined
  return {
    ok: item.ok && item.status === "valid",
    status: item.status,
    path: item.path,
    expires: typeof item.expires === "string" ? item.expires : null,
    message: typeof item.message === "string" ? item.message : null,
  }
}

const runCli: CliRun = (args) => {
  const command = resolveOpencodeCommand(getCliPath())
  return new Promise((resolve, reject) => {
    const proc = cp.spawn(command, args, {
      shell: shouldUseShell(command),
      env: { ...process.env, OPENCODE_CALLER: "vscode-ui" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`command "${command}" timed out while checking the license`))
    }, 15_000)
    proc.stdout?.on("data", (chunk) => (stdout += String(chunk)))
    proc.stderr?.on("data", (chunk) => (stderr += String(chunk)))
    proc.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      // Reuse the runtime "missing CLI" phrasing so existing runtime error handling recognizes it.
      if (error.code === "ENOENT") return reject(new Error(`command "${command}" was not found on the current host PATH`))
      if (error.code === "EACCES") return reject(new Error(`command "${command}" is not executable on the current host`))
      reject(error)
    })
    proc.once("exit", (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}
