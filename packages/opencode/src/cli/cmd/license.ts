import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import * as License from "@/license/license"
import { Brand } from "@/brand"

const unsupported = "License validation only supports Windows and Linux."

export const LicenseCommand = cmd({
  command: "license",
  describe: "license tools",
  builder: (yargs: Argv) => {
    return yargs
      .command(MachineIDCommand)
      .command(PathCommand)
      .command(StatusCommand)
      .demandCommand()
  },
  handler: () => {},
})

const MachineIDCommand = cmd({
  command: "machine-id",
  describe: "print this machine's license ID",
  handler: async () => {
    if (!License.isSupportedPlatform()) {
      console.log(unsupported)
      process.exitCode = 1
      return
    }
    console.log(await License.machineID())
  },
})

const PathCommand = cmd({
  command: "path",
  describe: "print the license file path",
  handler: () => {
    console.log(License.licensePath())
  },
})

const StatusCommand = cmd({
  command: "status",
  describe: "check the current license status",
  handler: async () => {
    const result = await validateStrong()
    console.log(formatStatus(result))
    if (!result.ok) process.exitCode = 1
  },
})

type StrongResult =
  | { ok: true; path: string }
  | { ok: false; path: string; reason: "missing" | "empty" | "read_error" | "invalid" | "expired"; message?: string }

async function validateStrong(): Promise<StrongResult> {
  const file = await License.validateFile()
  if (file.status !== "valid") {
    return { ok: false, path: file.path, reason: file.status, message: file.message }
  }
  if (!License.isSupportedPlatform()) {
    return { ok: false, path: file.path, reason: "invalid", message: unsupported }
  }
  const key = (await Bun.file(file.path).text()).trim()
  const id = await License.machineID()
  const check = License.validateLicenseKey(key, id)
  if (!check.valid) {
    return { ok: false, path: file.path, reason: check.reason ?? "invalid" }
  }
  return { ok: true, path: file.path }
}

export function shouldSkipLicenseGate(args: string[]) {
  return (
    args.some((arg) => arg === "--help" || arg === "-h" || arg === "--version" || arg === "-v") ||
    args[0] === "help" ||
    args[0] === "completion" ||
    args[0] === "license"
  )
}

export function shouldEnforceLicenseGate(args: string[]) {
  return !shouldSkipLicenseGate(args)
}

export async function enforceLicenseGate(args: string[]) {
  if (!shouldEnforceLicenseGate(args)) return
  const result = await validateStrong()
  if (result.ok) return

  process.stderr.write(formatGateFailure(result) + EOL)
  process.exit(1)
}

function formatStatus(result: StrongResult) {
  if (result.ok) {
    return [`${Brand.product} license is valid.`, `License file: ${result.path}`].filter(Boolean).join(EOL)
  }
  return formatGateFailure(result)
}

function formatGateFailure(result: Extract<StrongResult, { ok: false }>) {
  return [
    `${Brand.product} requires a valid license.`,
    `Status: ${statusLabel(result.reason)}`,
    `License file: ${result.path}`,
    result.message,
    `Generate a license for this machine and run \`${Brand.command} license status\` to verify.`,
  ]
    .filter(Boolean)
    .join(EOL)
}

function statusLabel(reason: Extract<StrongResult, { ok: false }>["reason"]) {
  if (reason === "read_error") return "read error"
  return reason
}
