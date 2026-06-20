import * as vscode from "vscode"
import { client } from "./sdk"
import { freeport, health, spawn, startupFailure, stop, type WorkspaceRuntime } from "./server"
import {
  licenseEnforceEnabled,
  openLicenseFile,
  promptForLicenseIssue,
  resolveLicensePath,
  validateLicense,
} from "../license"

type WorkspaceManagerDeps = {
  freeport?: typeof freeport
  health?: typeof health
  spawn?: typeof spawn
  client?: typeof client
  resolveLicensePath?: typeof resolveLicensePath
  validateLicense?: typeof validateLicense
  promptForLicenseIssue?: typeof promptForLicenseIssue
  openLicenseFile?: typeof openLicenseFile
  licenseEnforceEnabled?: typeof licenseEnforceEnabled
}

export class WorkspaceManager implements vscode.Disposable {
  private state = new Map<string, WorkspaceRuntime>()
  private dirIndex = new Map<string, string>()
  private ops = new Map<string, Promise<unknown>>()
  private shuttingDown = false
  private change = new vscode.EventEmitter<void>()

  readonly onDidChange = this.change.event

  constructor(private out: vscode.OutputChannel, private deps: WorkspaceManagerDeps = {}) {}

  list() {
    return [...this.state.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  get(dir: string) {
    return this.state.get(dir) ?? this.state.get(this.dirIndex.get(dir) || "")
  }

  invalidate() {
    this.fire()
  }

  async sync(folders: readonly vscode.WorkspaceFolder[]) {
    const next = new Set(folders.map((item) => workspaceId(item)))
    const gone = [...this.state.keys()].filter((id) => !next.has(id))

    await Promise.all(gone.map((id) => this.remove(id)))
    await Promise.all(folders.map((item) => this.ensure(item)))
  }

  async ensure(folder: vscode.WorkspaceFolder) {
    return this.serialize(workspaceId(folder), async () => this.ensureNow(folder))
  }

  async restart(id: string) {
    const folder = vscode.workspace.workspaceFolders?.find((item) => workspaceId(item) === id || item.uri.fsPath === id)

    if (!folder) {
      return
    }

    const key = workspaceId(folder)

    await this.serialize(key, async () => {
      await this.removeNow(key)
      return await this.ensureNow(folder)
    })
  }

  async remove(id: string) {
    const rt = this.get(id)
    if (!rt) {
      return
    }

    await this.serialize(rt.workspaceId, async () => this.removeNow(rt.workspaceId))
  }

  async shutdown() {
    this.shuttingDown = true
    await Promise.all([...this.state.keys()].map((dir) => this.remove(dir)))
  }

  dispose() {
    this.change.dispose()
    void this.shutdown()
  }

  private bind(rt: WorkspaceRuntime) {
    rt.proc?.stdout?.on("data", (buf) => {
      this.log(rt, String(buf).trimEnd())
    })

    rt.proc?.stderr?.on("data", (buf) => {
      this.log(rt, String(buf).trimEnd())
    })

    rt.proc?.on("exit", (code, signal) => {
      const cur = this.state.get(rt.workspaceId)

      if (!cur || cur.proc !== rt.proc) {
        return
      }

      if (cur.state === "stopping") {
        return
      }

      cur.state = "stopped"
      cur.sdk = undefined
      cur.err = code === 0 ? undefined : `exit code=${code ?? "unknown"} signal=${signal ?? "none"}`
      this.log(cur, `server exited code=${code ?? "unknown"} signal=${signal ?? "none"}`)
      this.fire()
    })

    rt.proc?.on("error", (err) => {
      const cur = this.state.get(rt.workspaceId)

      if (!cur) {
        return
      }

      cur.state = "error"
      cur.sdk = undefined
      cur.err = text(err)
      this.log(cur, `process error: ${cur.err}`)
      this.fire()
    })
  }

  private log(rt: WorkspaceRuntime, msg: string) {
    if (!msg) {
      return
    }

    this.out.appendLine(`[${rt.name}] ${msg}`)
  }

  private fire() {
    this.change.fire()
  }

  private async ensureNow(folder: vscode.WorkspaceFolder) {
    const id = workspaceId(folder)
    const dir = folder.uri.fsPath
    const cur = this.state.get(id)

    if (this.shuttingDown) {
      return cur
    }

    if (cur && (cur.state === "starting" || cur.state === "ready")) {
      return cur
    }

    if (cur?.proc) {
      await stop(cur.proc)
    }

    // License 网关:默认关闭,仅当 HYPERCODE_LICENSE_ENFORCE=1 时强制生效。
    const enforce = (this.deps.licenseEnforceEnabled ?? licenseEnforceEnabled)()
    if (enforce) {
      const licensePath = (this.deps.resolveLicensePath ?? resolveLicensePath)()
      const license = await (this.deps.validateLicense ?? validateLicense)({ licensePath, enforce: true })
      if (!license.ok) {
        const rt: WorkspaceRuntime = {
          workspaceId: id,
          dir,
          name: folder.name,
          port: 0,
          url: "",
          state: "error",
          sessions: new Map(),
          sessionStatuses: new Map(),
          sessionsState: "idle",
          err: license.message,
        }
        this.state.set(id, rt)
        this.dirIndex.set(dir, id)
        this.log(rt, `license check failed: ${license.reason} ${license.message}`)
        this.fire()
        void this.handleLicenseFailure(license.message)
        return rt
      }
    }

    const port = await (this.deps.freeport ?? freeport)()
    const url = `http://127.0.0.1:${port}`
    const proc = (this.deps.spawn ?? spawn)(dir, port)
    const startup = startupFailure(proc)
    const rt: WorkspaceRuntime = {
      workspaceId: id,
      dir,
      name: folder.name,
      port,
      url,
      state: "starting",
      sessions: new Map(),
      sessionStatuses: new Map(),
      sessionsState: "idle",
      pid: proc.pid,
      proc,
    }

    this.state.set(id, rt)
    this.dirIndex.set(dir, id)
    this.log(rt, `starting server on ${url} for ${hostLabel(folder)} cwd=${dir}`)
    this.bind(rt)
    this.fire()

    try {
      await Promise.race([(this.deps.health ?? health)(url, 800, 25), startup.promise])
      const live = this.state.get(id)
      if (live !== rt || rt.state === "stopping") {
        startup.dispose()
        return live
      }

      startup.dispose()
      rt.sdk = await (this.deps.client ?? client)(url, dir)
      rt.state = "ready"
      rt.err = undefined
      this.log(rt, `server ready on ${hostLabel(folder)}`)
    } catch (err) {
      startup.dispose()
      const live = this.state.get(id)
      if (live !== rt || rt.state === "stopping") {
        return live
      }

      rt.state = "error"
      rt.sdk = undefined
      rt.err = text(err)
      this.log(rt, `server failed: ${rt.err}`)
    }

    this.fire()
    return this.state.get(id)
  }

  private async removeNow(id: string) {
    const rt = this.state.get(id)

    if (!rt) {
      return
    }

    rt.state = "stopping"
    rt.sdk = undefined
    rt.err = undefined
    this.fire()
    await stop(rt.proc)

    if (this.state.get(id) === rt) {
      this.state.delete(id)
      this.dirIndex.delete(rt.dir)
      this.fire()
    }

    this.log(rt, "server stopped")
  }

  private async handleLicenseFailure(message: string) {
    const action = await (this.deps.promptForLicenseIssue ?? promptForLicenseIssue)(
      `HyperCode 授权检查失败：${message}`,
    )

    if (action === "打开授权文件" || action === "创建授权文件") {
      await (this.deps.openLicenseFile ?? openLicenseFile)()
      return
    }

    if (action === "重试授权检查") {
      await this.sync(vscode.workspace.workspaceFolders ?? [])
    }
  }

  private async serialize<T>(dir: string, run: () => Promise<T>) {
    const prev = this.ops.get(dir) || Promise.resolve()
    const next = prev
      .catch(() => {})
      .then(run)
    this.ops.set(dir, next)
    try {
      return await next
    } finally {
      if (this.ops.get(dir) === next) {
        this.ops.delete(dir)
      }
    }
  }
}

function workspaceId(folder: vscode.WorkspaceFolder) {
  return folder.uri.toString()
}

function text(err: unknown) {
  if (err instanceof Error) {
    return err.message
  }

  return String(err)
}

function hostLabel(folder: vscode.WorkspaceFolder) {
  const remote = vscode.env.remoteName || "local"
  return `${folder.uri.scheme}:${folder.name} host=${remote}`
}
