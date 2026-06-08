#!/usr/bin/env node

import fs from "fs/promises"
import os from "os"
import path from "path"

const argv = process.argv.slice(2)
const write = argv.includes("--write")
const dryRun = !write || argv.includes("--dry-run")
const report = argv.includes("--report")
const syntheticDrill = argv.includes("--synthetic-drill")
const root = resolveRoot(argv)

const protectedPatterns = {
  import_namespace: /@opencode-ai\/[A-Za-z0-9/_-]+/g,
  package_directory: /packages\/opencode\b/g,
  provider_id: /provider(?:\.id|ID)\s*[:=]+\s*["']opencode["']/g,
  command_id: /["']opencode\.[A-Za-z0-9._-]+["']/g,
  cli_compat_entry: /["']opencode["']\s*:/g,
  opencode_fallback_env: /\bOPENCODE_[A-Z0-9_]+\b/g,
  opencode_fallback_path: /\B\.opencode\b/g,
  opencode_config_fallback: /\bopencode\.jsonc?\b/g,
  upstream_attribution_url: /https:\/\/github\.com\/anomalyco\/opencode\b/g,
}

const brandPointCoverage = [
  {
    id: "cli-banner-and-help",
    status: "supported",
    files: [
      "packages/opencode/src/index.ts",
      "packages/opencode/src/cli/error.ts",
      "packages/opencode/src/temporary.ts",
    ],
    notes: "Rewrites only user-visible CLI banner/help fragments.",
  },
  {
    id: "app-english-visible-copy",
    status: "supported",
    files: ["packages/app/src/i18n/en.ts", "packages/desktop/src/renderer/i18n/en.ts"],
    notes: "Rewrites only visible OpenCode string values, not keys or compatibility tokens.",
  },
  {
    id: "vscode-visible-metadata",
    status: "supported",
    files: ["sdks/vscode/package.json"],
    notes: "Rewrites extension display metadata and visible titles, not command ids or repo url.",
  },
  {
    id: "tui-home-visible-copy",
    status: "manual-check-required",
    files: ["packages/tui/src/**"],
    notes: "Outside the current Phase 4 auto-write allowlist.",
  },
  {
    id: "opencode-zen-provider-display-name",
    status: "manual-check-required",
    files: ["packages/opencode/src/provider/provider.ts"],
    notes: "Provider metadata override remains a business-source patch and is not auto-written here.",
  },
  {
    id: "vscode-launch-command",
    status: "manual-check-required",
    files: ["sdks/vscode/src/**"],
    notes: "Plugin source is intentionally excluded from this hardening pass.",
  },
  {
    id: "vsix-output-name",
    status: "manual-check-required",
    files: ["sdks/vscode/dist/hypercode.vsix"],
    notes: "Build artifact naming is not auto-written by this script.",
  },
  {
    id: "windows-dist-and-exe-name",
    status: "manual-check-required",
    files: ["packages/opencode/dist/hypercode-windows-x64/**"],
    notes: "Runtime artifacts are validated manually, not rewritten here.",
  },
  {
    id: "hypercode-env-priority-with-opencode-fallback",
    status: "manual-check-required",
    files: ["packages/core/src/**", "packages/opencode/src/**"],
    notes: "Compatibility fallback logic is protected from auto-rewrite.",
  },
]

const fileRules = [
  {
    file: "README.md",
    mode: "manual-only",
    reason: "Contains infrastructure URLs, package manager names, and compatibility-sensitive install guidance.",
  },
  {
    file: "docs/hypercode-rebrand-audit.md",
    mode: "manual-only",
    reason: "Intentionally documents remaining OpenCode/OpenCode-compatible internals and upstream attribution.",
  },
  {
    file: "docs/hypercode-rebrand-report.md",
    mode: "manual-only",
    reason: "Intentionally documents compatibility fallbacks and script names.",
  },
  {
    file: "packages/app/src/i18n/en.ts",
    mode: "auto",
    protectedSignals: [
      signal("provider_keys", /"dialog\.provider\.opencode[^"]*"/g),
      signal("provider_connect_keys", /"provider\.connect\.opencodeZen[^"]*"/g),
      signal("compat_config", /hypercode\.json or opencode\.json/g),
      signal("zen_url", /opencode\.ai\/zen/g),
      signal("wsl_opencode_keys", /"wsl\.onboarding\.[^"]*opencode[^"]*"/g),
    ],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule("visible_open_code", "OpenCode", "HyperCode", "Rewrite visible app English brand strings."),
      ]),
  },
  {
    file: "packages/desktop/src/renderer/i18n/en.ts",
    mode: "auto",
    protectedSignals: [],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule("visible_open_code", "OpenCode", "HyperCode", "Rewrite visible desktop updater English strings."),
      ]),
  },
  {
    file: "packages/opencode/src/cli/error.ts",
    mode: "auto",
    protectedSignals: [
      signal("import_namespace", protectedPatterns.import_namespace),
      signal("compat_config", /hypercode\.json or opencode\.json/g),
    ],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule(
          "mcp_error_brand",
          "OpenCode does not support MCP authentication yet.",
          "HyperCode does not support MCP authentication yet.",
          "Rewrite visible MCP authentication branding.",
        ),
        literalRule(
          "models_command",
          "`opencode models`",
          "`hypercode models`",
          "Rewrite visible CLI examples while preserving opencode compatibility elsewhere.",
        ),
      ]),
  },
  {
    file: "packages/opencode/src/index.ts",
    mode: "auto",
    protectedSignals: [
      signal("import_namespace", protectedPatterns.import_namespace),
      signal("process_import", /@opencode-ai\/core\/util\/opencode-process/g),
      signal("opencode_env", protectedPatterns.opencode_fallback_env),
      signal("log_namespace", /Log\.Default\.info\("opencode"/g),
    ],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule(
          "prefix_guard",
          'text.startsWith("opencode ")',
          'text.startsWith("hypercode ")',
          "Rewrite visible CLI prefix guard used by help/banner output.",
        ),
        literalRule(
          "script_name",
          '.scriptName("opencode")',
          '.scriptName("hypercode")',
          "Rewrite visible CLI script name.",
        ),
      ]),
  },
  {
    file: "packages/opencode/src/temporary.ts",
    mode: "auto",
    protectedSignals: [signal("import_namespace", protectedPatterns.import_namespace)],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule(
          "script_name",
          '.scriptName("opencode")',
          '.scriptName("hypercode")',
          "Rewrite visible temporary CLI script name.",
        ),
      ]),
  },
  {
    file: "sdks/vscode/package.json",
    mode: "auto",
    protectedSignals: [
      signal("command_id", protectedPatterns.command_id),
      signal("upstream_attribution_url", protectedPatterns.upstream_attribution_url),
    ],
    apply: transformVscodePackageJson,
  },
]

if (syntheticDrill) {
  const syntheticResult = await runSyntheticDrill()
  output(syntheticResult, report)
  process.exit(syntheticResult.ok ? 0 : 1)
}

const result = await runRebrand({ root, dryRun })
output(result, report)
process.exit(result.status === "blocked" ? 1 : 0)

function resolveRoot(input) {
  const rootIndex = input.indexOf("--root")
  if (rootIndex === -1) return process.cwd()
  const value = input[rootIndex + 1]
  if (!value) throw new Error("Expected a path after --root")
  return path.resolve(value)
}

function signal(id, pattern) {
  return { id, pattern }
}

function literalRule(id, find, replace, description) {
  return { id, find, replace, description }
}

async function runRebrand(options) {
  const summary = {
    status: "ok",
    mode: options.dryRun ? "dry-run" : "write",
    root: options.root,
    allowlist: fileRules.map((rule) => ({
      file: rule.file,
      mode: rule.mode,
      reason: rule.reason ?? null,
    })),
    brandPointCoverage,
    planned: [],
    written: [],
    blocked: [],
    protectedObserved: [],
    manualReview: [],
    skipped: [],
  }

  for (const rule of fileRules) {
    const file = path.join(options.root, rule.file)
    const text = await readUtf8(file)
    if (text === undefined) {
      summary.skipped.push({ file: rule.file, reason: "missing" })
      continue
    }

    if (rule.mode === "manual-only") {
      summary.manualReview.push({
        file: rule.file,
        reason: rule.reason,
        matches: collectMatches(text, Object.entries(protectedPatterns).map(([id, pattern]) => signal(id, pattern))),
      })
      continue
    }

    const beforeProtected = collectMatches(text, rule.protectedSignals)
    if (beforeProtected.length) {
      summary.protectedObserved.push({ file: rule.file, matches: beforeProtected })
    }

    const transformed = rule.apply(text)
    if (!transformed.changes.length) {
      summary.skipped.push({ file: rule.file, reason: "no-op" })
      continue
    }

    const blocked = compareProtected(rule.protectedSignals, text, transformed.text)
    if (blocked.length) {
      summary.status = "blocked"
      summary.blocked.push({
        file: rule.file,
        reason: "protected-content-would-change",
        blocked,
        attemptedChanges: transformed.changes,
      })
      continue
    }

    summary.planned.push({
      file: rule.file,
      changes: transformed.changes,
    })

    if (options.dryRun) continue
    await fs.writeFile(file, transformed.text)
    summary.written.push(rule.file)
  }

  return summary
}

function applyLiteralRules(text, rules) {
  let next = text
  const changes = []

  for (const rule of rules) {
    const count = countLiteral(next, rule.find)
    if (!count) continue
    next = next.split(rule.find).join(rule.replace)
    changes.push({
      rule: rule.id,
      description: rule.description,
      count,
      from: rule.find,
      to: rule.replace,
    })
  }

  return { text: next, changes }
}

function transformVscodePackageJson(text) {
  const data = JSON.parse(text)
  const changes = []

  if (data.name === "opencode") {
    data.name = "hypercode"
    changes.push({
      rule: "extension_name",
      description: "Rewrite visible VS Code extension package name.",
      count: 1,
      from: "opencode",
      to: "hypercode",
    })
  }

  const description = replaceVisibleBrand(data.description)
  if (description !== data.description) {
    changes.push({
      rule: "extension_description",
      description: "Rewrite visible VS Code extension description.",
      count: 1,
      from: data.description,
      to: description,
    })
    data.description = description
  }

  const displayName = replaceVisibleBrand(data.displayName)
  if (displayName !== data.displayName) {
    changes.push({
      rule: "extension_display_name",
      description: "Rewrite visible VS Code extension display name.",
      count: 1,
      from: data.displayName,
      to: displayName,
    })
    data.displayName = displayName
  }

  const commands = data.contributes?.commands ?? []
  commands.forEach((command, index) => {
    const title = replaceVisibleBrand(command.title)
    if (title === command.title) return
    changes.push({
      rule: `command_title_${index}`,
      description: "Rewrite visible VS Code command titles.",
      count: 1,
      from: command.title,
      to: title,
    })
    command.title = title
  })

  const keybindings = data.contributes?.keybindings ?? []
  keybindings.forEach((binding, index) => {
    if (typeof binding.title !== "string") return
    const title = replaceVisibleBrand(binding.title)
    if (title === binding.title) return
    changes.push({
      rule: `keybinding_title_${index}`,
      description: "Rewrite visible VS Code keybinding titles.",
      count: 1,
      from: binding.title,
      to: title,
    })
    binding.title = title
  })

  return {
    text: JSON.stringify(data, null, 2) + "\n",
    changes,
  }
}

function replaceVisibleBrand(value) {
  if (typeof value !== "string") return value
  return value.replace(/\bOpenCode\b/g, "HyperCode").replace(/\bopencode\b/g, "hypercode")
}

function compareProtected(signals, before, after) {
  return signals.flatMap((entry) => {
    const beforeMatches = collectPatternMatches(before, entry.pattern)
    const afterMatches = collectPatternMatches(after, entry.pattern)
    if (JSON.stringify(beforeMatches) === JSON.stringify(afterMatches)) return []
    return [
      {
        signal: entry.id,
        before: beforeMatches,
        after: afterMatches,
      },
    ]
  })
}

function collectMatches(text, signals) {
  return signals
    .map((entry) => {
      const matches = collectPatternMatches(text, entry.pattern)
      if (!matches.length) return undefined
      return {
        signal: entry.id,
        count: matches.length,
        samples: matches.slice(0, 5),
      }
    })
    .filter(Boolean)
}

function collectPatternMatches(text, pattern) {
  return [...text.matchAll(globalPattern(pattern))].map((match) => match[0])
}

function globalPattern(pattern) {
  return new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
}

function countLiteral(text, value) {
  if (!value) return 0
  return text.split(value).length - 1
}

async function readUtf8(file) {
  try {
    return await fs.readFile(file, "utf8")
  } catch {
    return undefined
  }
}

async function runSyntheticDrill() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hypercode-rebrand-"))
  await createSyntheticFixture(tempRoot)

  try {
    const dryRunResult = await runRebrand({ root: tempRoot, dryRun: true })
    const writeResult = await runRebrand({ root: tempRoot, dryRun: false })
    const verification = await verifySyntheticFixture(tempRoot)
    const ok =
      dryRunResult.status === "ok" &&
      writeResult.status === "ok" &&
      verification.ok &&
      dryRunResult.planned.length > 0 &&
      dryRunResult.manualReview.some((item) => item.file === "README.md")

    return {
      ok,
      mode: "synthetic-drill",
      root: tempRoot,
      dryRun: dryRunResult,
      write: writeResult,
      verification,
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
}

async function createSyntheticFixture(rootDir) {
  const files = {
    "README.md": [
      "# OpenCode",
      "curl -fsSL https://opencode.ai/install | bash",
      "npm i -g opencode-ai",
      "https://github.com/anomalyco/opencode",
    ].join("\n"),
    "packages/app/src/i18n/en.ts": [
      'export const dict = {',
      '  "dialog.provider.opencode.note": "OpenCode default provider",',
      '  "provider.connect.opencodeZen.line1": "OpenCode Zen is available here.",',
      '  "provider.connect.opencodeZen.visit.link": "opencode.ai/zen",',
      '  "error.chain.checkConfig": "Check your config (hypercode.json or opencode.json) provider/model names",',
      "}",
    ].join("\n"),
    "packages/desktop/src/renderer/i18n/en.ts": [
      "export const dict = {",
      '  "desktop.updater.none.message": "You are already using the latest version of OpenCode",',
      "}",
    ].join("\n"),
    "packages/opencode/src/cli/error.ts": [
      'import { NamedError } from "@opencode-ai/core/util/error"',
      'export const msg = "OpenCode does not support MCP authentication yet."',
      'export const help = "Try: `opencode models` to list available models"',
      'export const config = "Or check your config (hypercode.json or opencode.json) provider/model names"',
    ].join("\n"),
    "packages/opencode/src/index.ts": [
      'import * as Log from "@opencode-ai/core/util/log"',
      'import { ensureProcessMetadata } from "@opencode-ai/core/util/opencode-process"',
      'if (!text.startsWith("opencode ")) return',
      '.scriptName("opencode")',
      'process.env.OPENCODE_PURE = "1"',
      'Log.Default.info("opencode", {})',
    ].join("\n"),
    "packages/opencode/src/temporary.ts": [
      'import { InstallationVersion } from "@opencode-ai/core/installation/version"',
      '.scriptName("opencode")',
    ].join("\n"),
    "sdks/vscode/package.json": JSON.stringify(
      {
        name: "opencode",
        displayName: "OpenCode",
        description: "OpenCode for VS Code",
        repository: {
          type: "git",
          url: "https://github.com/anomalyco/opencode",
        },
        contributes: {
          commands: [
            {
              command: "opencode.openTerminal",
              title: "Open OpenCode",
            },
          ],
          keybindings: [
            {
              command: "opencode.openTerminal",
              title: "Run OpenCode",
            },
          ],
        },
      },
      null,
      2,
    ),
  }

  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(rootDir, relative)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content + (content.endsWith("\n") ? "" : "\n"))
  }
}

async function verifySyntheticFixture(rootDir) {
  const read = async (relative) => fs.readFile(path.join(rootDir, relative), "utf8")
  const appI18n = await read("packages/app/src/i18n/en.ts")
  const desktopI18n = await read("packages/desktop/src/renderer/i18n/en.ts")
  const cliError = await read("packages/opencode/src/cli/error.ts")
  const cliIndex = await read("packages/opencode/src/index.ts")
  const temporary = await read("packages/opencode/src/temporary.ts")
  const vscodePackage = await read("sdks/vscode/package.json")
  const readme = await read("README.md")

  const checks = [
    check("app-visible-brand", appI18n.includes("HyperCode default provider")),
    check("app-opencode-zen-visible-brand", appI18n.includes("HyperCode Zen is available here.")),
    check("app-link-protected", appI18n.includes("opencode.ai/zen")),
    check("app-config-fallback-protected", appI18n.includes("hypercode.json or opencode.json")),
    check("desktop-visible-brand", desktopI18n.includes("latest version of HyperCode")),
    check("cli-error-brand", cliError.includes("HyperCode does not support MCP authentication yet.")),
    check("cli-error-example", cliError.includes("`hypercode models`")),
    check("cli-error-config-protected", cliError.includes("hypercode.json or opencode.json")),
    check("cli-import-protected", cliIndex.includes('@opencode-ai/core/util/log')),
    check("cli-process-import-protected", cliIndex.includes('@opencode-ai/core/util/opencode-process')),
    check("cli-script-name", cliIndex.includes('.scriptName("hypercode")')),
    check("cli-prefix-guard", cliIndex.includes('text.startsWith("hypercode ")')),
    check("cli-env-protected", cliIndex.includes("process.env.OPENCODE_PURE")),
    check("cli-log-protected", cliIndex.includes('Log.Default.info("opencode"')),
    check("temporary-script-name", temporary.includes('.scriptName("hypercode")')),
    check("temporary-import-protected", temporary.includes('@opencode-ai/core/installation/version')),
    check("vscode-name", JSON.parse(vscodePackage).name === "hypercode"),
    check("vscode-display-name", JSON.parse(vscodePackage).displayName === "HyperCode"),
    check(
      "vscode-command-id-protected",
      JSON.parse(vscodePackage).contributes.commands[0].command === "opencode.openTerminal",
    ),
    check(
      "vscode-title-rewritten",
      JSON.parse(vscodePackage).contributes.commands[0].title === "Open HyperCode",
    ),
    check(
      "vscode-repo-url-protected",
      JSON.parse(vscodePackage).repository.url === "https://github.com/anomalyco/opencode",
    ),
    check("manual-readme-protected", readme.includes("https://opencode.ai/install")),
  ]

  return {
    ok: checks.every((item) => item.ok),
    checks,
  }
}

function check(id, ok) {
  return { id, ok }
}

function output(result, asJson) {
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    return
  }

  process.stdout.write(`Mode: ${result.mode}\n`)
  if ("status" in result) process.stdout.write(`Status: ${result.status}\n`)
  if ("root" in result) process.stdout.write(`Root: ${result.root}\n`)
  if ("planned" in result) process.stdout.write(`Planned files: ${result.planned.length}\n`)
  if ("written" in result) process.stdout.write(`Written files: ${result.written.length}\n`)
  if ("blocked" in result) process.stdout.write(`Blocked files: ${result.blocked.length}\n`)
  if ("manualReview" in result) process.stdout.write(`Manual review files: ${result.manualReview.length}\n`)
  if ("synthetic-drill" === result.mode) process.stdout.write(`Synthetic drill: ${result.ok ? "passed" : "failed"}\n`)
}
