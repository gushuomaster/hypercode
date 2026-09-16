import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("measures the maintained upstream fork surface", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hypercode-sync-test-"))
  try {
    await Promise.all([
      fs.mkdir(path.join(directory, "packages", "core", "src"), { recursive: true }),
      fs.mkdir(path.join(directory, "packages", "opencode", "src"), { recursive: true }),
    ])
    await Promise.all([
      Bun.write(path.join(directory, "README.md"), "baseline\n"),
      Bun.write(path.join(directory, "packages", "core", "src", "core.ts"), "export const core = 1\n"),
      Bun.write(path.join(directory, "packages", "opencode", "src", "app.ts"), "export const app = 1\n"),
    ])
    runGit(directory, "init")
    runGit(directory, "config", "user.email", "sync-test@hypercode.local")
    runGit(directory, "config", "user.name", "HyperCode Sync Test")
    runGit(directory, "add", ".")
    runGit(directory, "commit", "-m", "test: establish upstream fixture")
    const upstream = runGit(directory, "rev-parse", "HEAD")

    await Promise.all([
      Bun.write(path.join(directory, "README.md"), "current\n"),
      Bun.write(path.join(directory, "packages", "core", "src", "core.ts"), "export const core = 2\n"),
      Bun.write(path.join(directory, "packages", "opencode", "src", "app.ts"), "export const app = 2\n"),
      Bun.write(
        path.join(directory, "packages", "opencode", "src", "hypercode-only.ts"),
        "export const custom = true\n",
      ),
    ])
    runGit(directory, "add", ".")
    runGit(directory, "commit", "-m", "test: establish fork fixture")

    const script = path.join(import.meta.dir, "..", "..", "..", "..", "scripts", "sync-opencode-upstream.ps1")
    const result = Bun.spawnSync({
      cmd: [
        process.platform === "win32" ? "powershell.exe" : "pwsh",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-Mode",
        "Measure",
        "-UpstreamCommit",
        upstream,
        "-CurrentRef",
        "HEAD",
        "-Json",
      ],
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toEqual({
      upstreamCommit: upstream,
      currentRef: "HEAD",
      modifiedUpstreamFiles: 3,
      productionPaths: 2,
      corePatchPaths: 2,
      technicalSurface: 4,
    })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

function runGit(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
  return result.stdout.toString().trim()
}
