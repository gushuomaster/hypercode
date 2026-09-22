#!/usr/bin/env bun

import path from "node:path"

type Environment = Record<string, string | undefined>

export function validationBuildEnvironment(version: string, environment: Environment) {
  return {
    ...environment,
    OPENCODE_VERSION: version,
    OPENCODE_CHANNEL: "dev",
  }
}

export function requireBuiltVersion(expected: string, output: string) {
  const actual = output.trim()
  if (actual === expected) return
  throw new Error(`Expected HyperCode ${expected}, received ${actual || "no version"}`)
}

if (import.meta.main) {
  if (process.platform !== "win32") throw new Error("The Windows validation build must run on Windows.")

  const root = path.resolve(import.meta.dir, "..")
  const packageDir = path.join(root, "packages", "opencode")
  const packageJson: unknown = await Bun.file(path.join(packageDir, "package.json")).json()
  if (!packageJson || typeof packageJson !== "object" || !("version" in packageJson)) {
    throw new Error("packages/opencode/package.json must define a version.")
  }
  if (typeof packageJson.version !== "string") {
    throw new Error("packages/opencode/package.json must define a string version.")
  }

  const build = Bun.spawn({
    cmd: [
      process.execPath,
      "run",
      "build",
      "--target",
      "windows-x64",
      "--skip-install",
      "--skip-embed-web-ui",
    ],
    cwd: packageDir,
    env: validationBuildEnvironment(packageJson.version, process.env),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  if ((await build.exited) !== 0) throw new Error("HyperCode Windows validation build failed.")

  const executable = path.join(packageDir, "dist", "hypercode-windows-x64", "bin", "hypercode.exe")
  const check = Bun.spawn({ cmd: [executable, "--version"], stdout: "pipe", stderr: "inherit" })
  const output = await new Response(check.stdout).text()
  if ((await check.exited) !== 0) throw new Error("Built HyperCode executable did not report its version.")
  requireBuiltVersion(packageJson.version, output)
  console.log(`Windows validation executable: ${executable}`)
  console.log(`Validated version: ${packageJson.version} (dev channel)`)
}
