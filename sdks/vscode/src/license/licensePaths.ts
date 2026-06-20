import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { LicensePathsOptions } from "./licenseTypes"

export function resolveLicensePath(options: LicensePathsOptions = {}) {
  const platform = options.platform ?? process.platform
  if (platform === "win32") {
    return "C:\\hyper-aicode\\license.txt"
  }

  return path.join((options.homedir ?? os.homedir)(), "hyper-aicode", "license.txt")
}

export async function ensureLicenseFile(targetPath: string) {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })

  try {
    await fs.access(targetPath)
  } catch {
    await fs.writeFile(targetPath, "")
  }

  return targetPath
}
