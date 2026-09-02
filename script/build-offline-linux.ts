#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { createHash } from "node:crypto"
import semver from "semver"
import { createOfflineLinuxPackage } from "../packages/opencode/script/offline-package"

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
  },
  strict: true,
  allowPositionals: false,
}).values

if (!args.version || !semver.valid(args.version)) {
  throw new Error("A valid semantic version is required: --version 1.17.3")
}

const root = path.resolve(import.meta.dir, "..")
const packageDir = path.join(root, "packages", "opencode")
const bunVersion = (await Bun.file(path.join(root, "package.json")).json()).packageManager.split("@")[1]
const compilers = await Promise.all([
  prepareCompiler({
    root,
    version: bunVersion,
    target: "linux-x64",
    checksum: "951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f",
  }),
  prepareCompiler({
    root,
    version: bunVersion,
    target: "linux-x64-baseline",
    checksum: "a063908ae08b7852ca10939bbdc6ceed3ddabce8fb9402dce83d65d73b36e6c7",
  }),
])
const env = {
  ...process.env,
  HYPERCODE_BUN_EXECUTABLE_LINUX_X64: compilers[0],
  HYPERCODE_BUN_EXECUTABLE_LINUX_X64_BASELINE: compilers[1],
  MODELS_DEV_API_JSON: path.join(root, "script", "offline-linux", "models.json"),
  OPENCODE_VERSION: args.version,
  OPENCODE_RELEASE: "",
}
const build = Bun.spawn({
  cmd: [
    process.execPath,
    "run",
    "build",
    "--target",
    "linux-x64",
    "--target",
    "linux-x64-baseline",
  ],
  cwd: packageDir,
  env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
})

if ((await build.exited) !== 0) throw new Error("HyperCode Linux build failed")

const standardBinary = path.join(packageDir, "dist", "hypercode-linux-x64", "bin", "hypercode")
const baselineBinary = path.join(packageDir, "dist", "hypercode-linux-x64-baseline", "bin", "hypercode")
await Promise.all([fs.access(standardBinary), fs.access(baselineBinary)])

const result = await createOfflineLinuxPackage({
  version: args.version,
  outputDir: path.join(root, "release-artifacts"),
  standardBinary,
  baselineBinary,
})

console.log(`Offline package: ${result.archive}`)
console.log(`SHA-256 file: ${result.checksum}`)

async function prepareCompiler(input: { root: string; version: string; target: string; checksum: string }) {
  const cache = path.join(input.root, "node_modules", ".cache", "hypercode-bun-cross", input.version)
  const archive = path.join(cache, `bun-${input.target}.zip`)
  const directory = path.join(cache, input.target)
  const executable = path.join(directory, `bun-${input.target}`, "bun")

  const validArchive = await validFile(archive, input.checksum)
  if (validArchive && (await exists(executable))) return executable

  await fs.mkdir(cache, { recursive: true })
  if (!validArchive) {
    const response = await fetch(
      `https://github.com/oven-sh/bun/releases/download/bun-v${input.version}/bun-${input.target}.zip`,
    )
    if (!response.ok) throw new Error(`Failed to download Bun compiler ${input.target}: ${response.status}`)
    await Bun.write(archive, response)
    if (!(await validFile(archive, input.checksum))) throw new Error(`Invalid checksum for Bun compiler ${input.target}`)
  }

  await fs.mkdir(directory, { recursive: true })
  const extract = Bun.spawn({
    cmd: ["tar", "-xf", archive, "-C", directory],
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  })
  if ((await extract.exited) !== 0 || !(await exists(executable))) {
    throw new Error(`Failed to extract Bun compiler ${input.target}`)
  }
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
