import * as vscode from "vscode"
import { ensureLicenseFile, resolveLicensePath } from "./licensePaths"
import { t } from "../i18n"

export async function openLicenseFile() {
  const target = resolveLicensePath()
  await ensureLicenseFile(target)
  const document = await vscode.workspace.openTextDocument(target)
  await vscode.window.showTextDocument(document)
  return target
}

export async function promptForLicenseIssue(message: string) {
  return await vscode.window.showErrorMessage(
    message,
    t("license.open"),
    t("license.create"),
    t("license.retry"),
  )
}
