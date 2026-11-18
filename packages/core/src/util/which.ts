import whichPkg from "which"
import path from "path"
import { existsSync, lstatSync } from "fs"
import { Global } from "../global"

export function which(cmd: string, env?: NodeJS.ProcessEnv) {
  const base = env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path ?? ""
  const full = base ? base + path.delimiter + Global.Path.bin : Global.Path.bin
  const result = whichPkg.sync(cmd, {
    nothrow: true,
    path: full,
    pathExt: env?.PATHEXT ?? env?.PathExt ?? process.env.PATHEXT ?? process.env.PathExt,
  })
  return typeof result === "string" ? result : null
}

// Backport of upstream b6cfbec4cc (#61952, OpenCode 2.x): Microsoft Store apps, such as PowerShell 7, put app
// execution aliases in WindowsApps on PATH. They launch like any executable, but on Bun 1.4.4 stat rejects them with EACCES.
export function isAppExecutionAlias(file: string) {
  return (
    process.platform === "win32" &&
    lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink() === true &&
    existsSync(file)
  )
}
