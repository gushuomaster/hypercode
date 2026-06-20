import * as vscode from "vscode"
import { ensureLicenseFile, resolveLicensePath } from "./licensePaths"

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
    "打开授权文件",
    "创建授权文件",
    "重试授权检查",
  )
}
