#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const write = args.has("--write")
const dryRun = !write || args.has("--dry-run")
const report = args.has("--report")

const replacements = [
  [/OpenCode/g, "HyperCode"],
  [/OPENCODE/g, "HYPERCODE"],
  [/opencode/g, "hypercode"],
]

const allowlist = [
  "README.md",
  "docs/hypercode-rebrand-audit.md",
  "docs/hypercode-rebrand-report.md",
  "packages/app/src/i18n/en.ts",
  "packages/desktop/src/renderer/i18n/en.ts",
  "packages/opencode/src/cli/error.ts",
  "packages/opencode/src/index.ts",
  "packages/opencode/src/temporary.ts",
  "sdks/vscode/package.json",
]

const protectedPatterns = [/^LICENSE$/i, /\.lock$/i, /\.(png|jpg|jpeg|gif|ico|zip|svg|pdf)$/i]

const changed = []
const skipped = []

for (const relative of allowlist) {
  const file = path.join(root, relative)
  if (protectedPatterns.some((pattern) => pattern.test(relative))) {
    skipped.push({ file: relative, reason: "protected" })
    continue
  }

  let original
  try {
    original = await fs.readFile(file, "utf8")
  } catch {
    skipped.push({ file: relative, reason: "missing" })
    continue
  }

  const next = replacements.reduce((text, [pattern, value]) => text.replace(pattern, value), original)
  if (next === original) {
    skipped.push({ file: relative, reason: "no-op" })
    continue
  }

  changed.push(relative)
  if (!dryRun) await fs.writeFile(file, next)
}

const summary = {
  mode: dryRun ? "dry-run" : "write",
  changed,
  skipped,
}

if (report) {
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n")
} else {
  process.stdout.write(`Mode: ${summary.mode}\n`)
  process.stdout.write(`Changed (${changed.length}):\n`)
  for (const file of changed) process.stdout.write(`  - ${file}\n`)
  process.stdout.write(`Skipped (${skipped.length}):\n`)
  for (const item of skipped) process.stdout.write(`  - ${item.file}: ${item.reason}\n`)
}
