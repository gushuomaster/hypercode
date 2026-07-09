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
    const commands = [
      "wmic cpu get processorid",
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId).Trim()"',
      'pwsh -NoProfile -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId).Trim()"',
    ]
    let lastError: unknown

    for (const command of commands) {
      try {
        const id = parseWindowsMachineId(await run(command))
        if (id) return id
      } catch (error) {
        lastError = error
      }
    }

    if (lastError instanceof Error) throw lastError
    throw new Error("Unable to get Windows machine ID")
  }

  const value = (await run("cat /etc/machine-id")).trim()
  if (value) return value

  throw new Error("Unable to get machine ID")
}

function parseWindowsMachineId(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/^processorid$/i.test(line))
}
