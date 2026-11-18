import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as vscode from "vscode"
import { queryLicense, type LicenseQuery, type LicenseStatus } from "./licenseStatus"
import { t } from "../i18n"

/** Opens (creating if needed) the license file at the path reported by the CLI. */
export async function openLicenseFile(target?: string, query: () => Promise<LicenseQuery> = queryLicense) {
  const file = target ?? (await licenseFilePath(query))
  if (!file) return undefined
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, "", { flag: "a" })
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(file))
  return file
}

export async function promptForLicenseIssue(message: string) {
  return await vscode.window.showErrorMessage(message, t("license.open"), t("license.create"), t("license.retry"))
}

export function localizedLicenseMessage(result: LicenseStatus) {
  const key = statusKeys[result.status as keyof typeof statusKeys]
  if (!key) return result.message ?? result.status
  const text = t(key)
  return result.message ? `${text} ${result.message}` : text
}

async function licenseFilePath(query: () => Promise<LicenseQuery>) {
  const result = await query()
  if ("path" in result) return result.path
  void vscode.window.showErrorMessage(t("license.cliUnavailable", { message: result.message }))
  return undefined
}

const statusKeys = {
  missing: "license.fileMissing",
  empty: "license.fileEmpty",
  read_error: "license.readError",
  malformed: "license.malformed",
  legacy_format: "license.legacyFormat",
  bad_signature: "license.badSignature",
  machine_mismatch: "license.invalidMachine",
  expired: "license.expired",
  unsupported_platform: "license.unsupportedPlatform",
  machine_id_error: "license.machineIdError",
} as const
