import * as cp from "node:child_process"
import { promisify } from "node:util"
import { MachineIdOptions } from "./licenseTypes"

const execAsync = promisify(cp.exec)

async function defaultRun(command: string) {
  const result = await execAsync(command)
  return result.stdout
}

export async function getMachineId(options: MachineIdOptions = {}) {
  const platform = options.platform ?? process.platform
  const run = options.run ?? defaultRun

  if (platform === "win32") {
    const lines = (await run("wmic cpu get processorid")).split("\n").map((line) => line.trim()).filter(Boolean)
    if (lines.length > 1) {
      return lines[1]
    }

    throw new Error("无法获取系统标识符")
  }

  const value = (await run("cat /etc/machine-id")).trim()
  if (value) {
    return value
  }

  throw new Error("无法获取系统标识符")
}
