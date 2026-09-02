#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { createHash } from "node:crypto"
import semver from "semver"
import { createOfflineWindowsPackage } from "../packages/opencode/script/offline-windows-package"

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
    "vscode-installer": { type: "string" },
    "git-installer": { type: "string" },
    "skip-build": { type: "boolean" },
  },
  strict: true,
  allowPositionals: false,
}).values

if (process.platform !== "win32") throw new Error("The Windows offline package must be built on Windows.")

const root = path.resolve(import.meta.dir, "..")
const packageDir = path.join(root, "packages", "opencode")
const version = args.version ?? (await Bun.file(path.join(packageDir, "package.json")).json()).version
if (!semver.valid(version)) throw new Error("A valid semantic version is required: --version 1.17.3")

if (!args["skip-build"]) {
  const bunVersion = (await Bun.file(path.join(root, "package.json")).json()).packageManager.split("@")[1]
  if (bunVersion !== "1.3.14") throw new Error(`Unsupported Bun version for offline Windows build: ${bunVersion}`)
  const compilers = [
    await prepareCompiler({
      root,
      version: bunVersion,
      target: "windows-x64",
      checksum: "0a0620930b6675d7ba440e81f4e0e00d3cfbe096c4b140d3fff02205e9e18922",
    }),
    await prepareCompiler({
      root,
      version: bunVersion,
      target: "windows-x64-baseline",
      checksum: "538f9c846355d9e847b2671bc00c47da4229a0befb24df3282b739770f3b475f",
    }),
  ]
  await run(
    [process.execPath, "run", "build", "--target", "windows-x64", "--target", "windows-x64-baseline"],
    packageDir,
    {
      ...process.env,
      HYPERCODE_BUN_EXECUTABLE_WINDOWS_X64: compilers[0],
      HYPERCODE_BUN_EXECUTABLE_WINDOWS_X64_BASELINE: compilers[1],
      MODELS_DEV_API_JSON: path.join(root, "script", "offline-linux", "models.json"),
      OPENCODE_VERSION: version,
      OPENCODE_RELEASE: "",
    },
    "HyperCode Windows build failed",
  )

  const vscode = path.join(root, "sdks", "vscode")
  await run([process.execPath, "install", "--frozen-lockfile"], vscode, process.env, "VS Code dependency install failed")
  await run([process.execPath, "run", "package"], vscode, process.env, "VS Code extension build failed")
  await run(
    [
      "npx.cmd",
      "--yes",
      "@vscode/vsce",
      "package",
      "--no-git-tag-version",
      "--no-update-package-json",
      "--no-dependencies",
      "--skip-license",
      "-o",
      "dist/hypercode.vsix",
    ],
    vscode,
    process.env,
    "VS Code extension packaging failed",
  )
}

const standardBinary = path.join(packageDir, "dist", "hypercode-windows-x64", "bin", "hypercode.exe")
const baselineBinary = path.join(packageDir, "dist", "hypercode-windows-x64-baseline", "bin", "hypercode.exe")
const extension = path.join(root, "sdks", "vscode", "dist", "hypercode.vsix")
await Promise.all(
  [standardBinary, baselineBinary, extension, args["vscode-installer"], args["git-installer"]]
    .filter((file): file is string => Boolean(file))
    .map((file) => fs.access(path.resolve(file))),
)

const result = await createOfflineWindowsPackage({
  version,
  outputDir: path.join(root, "release-artifacts"),
  standardBinary,
  baselineBinary,
  extension,
  vscodeInstaller: args["vscode-installer"] ? path.resolve(args["vscode-installer"]) : undefined,
  gitInstaller: args["git-installer"] ? path.resolve(args["git-installer"]) : undefined,
})

console.log(`Offline package: ${result.archive}`)
console.log(`SHA-256 file: ${result.checksum}`)

async function run(command: string[], cwd: string, env: Record<string, string | undefined>, message: string) {
  const process = Bun.spawn({
    cmd: command,
    cwd,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  if ((await process.exited) !== 0) throw new Error(message)
}

async function prepareCompiler(input: { root: string; version: string; target: string; checksum: string }) {
  const cache = path.join(input.root, "node_modules", ".cache", "hypercode-bun-cross", input.version)
  const archive = path.join(cache, `bun-${input.target}.zip`)
  const partial = `${archive}.partial`
  const directory = path.join(cache, input.target)
  const executable = path.join(directory, `bun-${input.target}`, "bun.exe")

  const validArchive = await validFile(archive, input.checksum)
  if (validArchive && (await exists(executable))) return executable

  await fs.mkdir(cache, { recursive: true })
  if (!validArchive) {
    await fs.rm(partial, { force: true })
    console.log(`Downloading Bun compiler ${input.target}`)
    await run(
      [
        "curl.exe",
        "--fail",
        "--location",
        "--retry",
        "3",
        "--retry-all-errors",
        "--connect-timeout",
        "15",
        "--max-time",
        "600",
        "--output",
        partial,
        `https://github.com/oven-sh/bun/releases/download/bun-v${input.version}/bun-${input.target}.zip`,
      ],
      input.root,
      process.env,
      `Failed to download Bun compiler ${input.target}`,
    )
    if (!(await validFile(partial, input.checksum))) throw new Error(`Invalid checksum for Bun compiler ${input.target}`)
    await fs.rename(partial, archive)
  }

  await fs.rm(directory, { recursive: true, force: true })
  await fs.mkdir(directory, { recursive: true })
  await run(["tar", "-xf", archive, "-C", directory], input.root, process.env, `Failed to extract Bun compiler ${input.target}`)
  if (!(await exists(executable))) throw new Error(`Bun compiler executable is missing: ${input.target}`)
  return executable
}

async function validFile(file: string, checksum: string) {
  if (!(await exists(file))) return false
  const hash = createHash("sha256")
  for await (const chunk of Bun.file(file).stream()) hash.update(chunk)
  return hash.digest("hex") === checksum
}

async function exists(file: string) {
  return fs.access(file).then(
    () => true,
    () => false,
  )
}
