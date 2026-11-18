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
      "packages/opencode/src/cli/main.ts",
      "packages/opencode/src/cli/error.ts",
      "packages/opencode/src/temporary.ts",
    ],
    notes: "Auto-patches only user-visible CLI banner/help fragments.",
  },
  {
    id: "app-english-visible-copy",
    status: "out-of-delivery",
    files: ["packages/app/src/i18n/en.ts", "packages/desktop/src/renderer/i18n/en.ts"],
    notes: "Web and desktop apps are not HyperCode deliverables; left as upstream to avoid fork tax.",
  },
  {
    id: "vscode-visible-metadata",
    status: "supported",
    files: ["sdks/vscode/package.json"],
    notes: "Auto-patches extension metadata and visible command titles, not command ids or repo url.",
  },
  {
    id: "artifact-docs-and-publish-script",
    status: "supported",
    files: ["docs/hypercode-binary-plugin-distribution.md", "sdks/vscode/script/publish"],
    notes: "Auto-patches only user-visible artifact names and VSIX output strings.",
  },
  {
    id: "tui-home-visible-copy",
    status: "manual-check-required",
    files: ["packages/tui/src/**", "packages/opencode/src/cli/cmd/tui/**"],
    notes: "Runtime UI copy is reported, but not auto-written in this hardening pass.",
  },
  {
    id: "opencode-zen-provider-display-name",
    status: "manual-check-required",
    files: ["packages/opencode/src/provider/provider.ts"],
    notes: "Provider display-name override is audited read-only to avoid mutating business source here.",
  },
  {
    id: "vscode-launch-command",
    status: "manual-check-required",
    files: ["sdks/vscode/src/**"],
    notes: "Launch command and terminal labels are audited read-only; internal command ids remain protected.",
  },
  {
    id: "hypercode-env-priority-with-opencode-fallback",
    status: "manual-check-required",
    files: ["packages/core/src/**", "packages/opencode/src/**"],
    notes: "Env/config priority and compatibility fallback are audited read-only.",
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
    mode: "out-of-delivery",
    reason: "Web app is not a HyperCode deliverable (deliverables: hypercode.exe, hypercode.vsix, offline packages).",
  },
  {
    file: "packages/desktop/src/renderer/i18n/en.ts",
    mode: "out-of-delivery",
    reason: "Desktop app is not a HyperCode deliverable (deliverables: hypercode.exe, hypercode.vsix, offline packages).",
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
    // src/index.ts only dynamically imports ./cli/main; the visible CLI name and banner guard live in main.ts.
    file: "packages/opencode/src/cli/main.ts",
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
    file: "docs/hypercode-binary-plugin-distribution.md",
    mode: "auto",
    protectedSignals: [signal("package_directory", protectedPatterns.package_directory)],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule(
          "windows_dist_name",
          "opencode-windows-x64",
          "hypercode-windows-x64",
          "Rewrite visible Windows artifact directory names.",
        ),
        literalRule(
          "windows_exe_name",
          "opencode.exe",
          "hypercode.exe",
          "Rewrite visible Windows executable names.",
        ),
        literalRule("vsix_name", "opencode.vsix", "hypercode.vsix", "Rewrite visible VSIX artifact names."),
        literalRule(
          "artifact_wildcard",
          "opencode-*",
          "hypercode-*",
          "Rewrite visible artifact wildcard names.",
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
  {
    file: "sdks/vscode/script/publish",
    mode: "auto",
    protectedSignals: [],
    apply: (text) =>
      applyLiteralRules(text, [
        literalRule("vsix_name", "opencode.vsix", "hypercode.vsix", "Rewrite visible VSIX output names."),
      ]),
  },
]

const audits = [
  auditProviderDisplayName,
  auditVscodeLaunchCommand,
  auditArtifactNaming,
  auditConfigCompatibility,
  auditCliVisibleBrand,
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

function createSummary(options) {
  return {
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
    protected: [],
    manualCheckRequired: [],
    patchable: [],
    skipped: [],
    summary: {},
  }
}

async function runRebrand(options) {
  const summary = createSummary(options)

  for (const rule of fileRules) {
    if (rule.mode === "out-of-delivery") {
      summary.skipped.push({ file: rule.file, reason: "out-of-delivery" })
      continue
    }

    const file = path.join(options.root, rule.file)
    const text = await readUtf8(file)
    if (text === undefined) {
      summary.skipped.push({ file: rule.file, reason: "missing" })
      continue
    }

    if (rule.mode === "manual-only") {
      summary.manualCheckRequired.push({
        id: "manual-only-file",
        file: rule.file,
        severity: "manual-only",
        reason: rule.reason,
        matches: collectMatches(text, Object.entries(protectedPatterns).map(([id, pattern]) => signal(id, pattern))),
      })
      continue
    }

    const beforeProtected = collectMatches(text, rule.protectedSignals)
    if (beforeProtected.length) {
      summary.protected.push({
        id: "protected-signals",
        file: rule.file,
        status: "ok",
        signals: beforeProtected,
      })
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
        id: "protected-content-would-change",
        file: rule.file,
        reason: "protected-content-would-change",
        blocked,
        attemptedChanges: transformed.changes,
      })
      continue
    }

    const patchableEntry = {
      id: "allowlist-visible-brand",
      file: rule.file,
      strategy: "auto-allowlist",
      changes: transformed.changes,
    }
    summary.patchable.push(patchableEntry)
    summary.planned.push({
      file: rule.file,
      changes: transformed.changes,
    })

    if (options.dryRun) continue
    await fs.writeFile(file, transformed.text)
    summary.written.push(rule.file)
  }

  for (const audit of audits) {
    mergeAudit(summary, await audit(options.root))
  }

  summary.summary = buildSummary(summary)
  return summary
}

function mergeAudit(summary, audit) {
  summary.protected.push(...audit.protected)
  summary.manualCheckRequired.push(...audit.manualCheckRequired)
  summary.patchable.push(...audit.patchable)
  summary.blocked.push(...audit.blocked)
  if (audit.blocked.length) summary.status = "blocked"
}

function buildSummary(result) {
  return {
    status: result.status,
    plannedFiles: result.planned.length,
    writtenFiles: result.written.length,
    blockedEntries: result.blocked.length,
    protectedEntries: result.protected.length,
    manualCheckRequiredEntries: result.manualCheckRequired.length,
    patchableEntries: result.patchable.length,
    skippedFiles: result.skipped.length,
  }
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
  return value.replace(/\bOpenCode\b/g, "HyperCode").replace(/\bopencode\b/g, "HyperCode")
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

function emptyAudit() {
  return {
    protected: [],
    manualCheckRequired: [],
    patchable: [],
    blocked: [],
  }
}

function protectedFinding(id, file, details) {
  return { id, file, status: "ok", details }
}

function manualFinding(id, file, severity, details, recommendation) {
  return { id, file, severity, details, recommendation }
}

function patchableFinding(id, file, details, recommendation) {
  return { id, file, details, recommendation }
}

function blockedFinding(id, file, reason, details, recommendation) {
  return { id, file, reason, details, recommendation }
}

async function auditProviderDisplayName(rootDir) {
  const file = "packages/opencode/src/provider/provider.ts"
  const text = await readUtf8(path.join(rootDir, file))
  if (text === undefined) {
    return {
      ...emptyAudit(),
      manualCheckRequired: [
        manualFinding(
          "provider-display-name-missing",
          file,
          "missing",
          "Provider mapping file was not found for audit.",
          "Inspect the provider mapping manually.",
        ),
      ],
    }
  }

  const result = emptyAudit()
  const hasIdPassthrough = /id:\s*ProviderV2\.ID\.make\(provider\.id\)/.test(text)
  const hasDisplayOverride =
    /const displayName = provider\.id === "opencode" \? "HyperCode Zen" : provider\.name/.test(text)
  const usesDisplayName = /\bname:\s*displayName\b/.test(text)
  const renamedProviderId =
    /provider\.id\s*===\s*["']hypercode["']/.test(text) || /ProviderV2\.ID\.make\(["']hypercode["']\)/.test(text)
  const leaksOpenCodeZen = /OpenCode Zen/.test(text)

  if (renamedProviderId) {
    result.blocked.push(
      blockedFinding(
        "provider-id-renamed",
        file,
        "high-risk-compatibility-break",
        'Provider display-name audit detected a provider id rename to "hypercode".',
        'Keep the visible label as "HyperCode Zen" but preserve provider.id as "opencode".',
      ),
    )
  }

  if (hasIdPassthrough) {
    result.protected.push(
      protectedFinding("provider-id-preserved", file, 'Provider id still passes through as "opencode".'),
    )
  } else {
    result.manualCheckRequired.push(
      manualFinding(
        "provider-id-passthrough-missing",
        file,
        "high-risk",
        "Expected provider id passthrough was not found.",
        'Verify the returned provider id still comes from provider.id and remains "opencode".',
      ),
    )
  }

  if (hasDisplayOverride && usesDisplayName) {
    result.protected.push(
      protectedFinding("provider-display-name-hypercode-zen", file, 'Visible provider label resolves to "HyperCode Zen".'),
    )
  } else if (leaksOpenCodeZen) {
    result.manualCheckRequired.push(
      manualFinding(
        "provider-display-name-open-code-zen",
        file,
        "needs-manual-check",
        'Visible provider label still contains "OpenCode Zen".',
        'Override only the displayed provider name to "HyperCode Zen" while leaving provider.id unchanged.',
      ),
    )
  } else {
    result.manualCheckRequired.push(
      manualFinding(
        "provider-display-name-override-missing",
        file,
        "needs-manual-check",
        "Expected HyperCode Zen display-name override was not detected.",
        'Verify the provider display name is overridden to "HyperCode Zen" for provider.id === "opencode".',
      ),
    )
  }

  return result
}

// The extension no longer types a launch command into a terminal: core/server.ts spawns `<cli> serve --port` directly.
// Public command ids are `hypercode.*` by policy (docs/规范/上游同步与品牌化规范.md), so command ids are not audited here.
async function auditVscodeLaunchCommand(rootDir) {
  const file = "sdks/vscode/src/core/server.ts"
  const text = await readUtf8(path.join(rootDir, file))
  if (text === undefined) {
    return {
      ...emptyAudit(),
      manualCheckRequired: [
        manualFinding(
          "vscode-launch-command-missing",
          file,
          "missing",
          "VS Code server launch file was not found for audit.",
          "Inspect the launch command manually.",
        ),
      ],
    }
  }

  const result = emptyAudit()
  const prefersHypercode = text.includes('detectAvailableCommand(["hypercode", "opencode"]) ?? "hypercode"')
  const defaultsToOpenCode = /detectAvailableCommand\(\["opencode"/.test(text) || /\?\? "opencode"/.test(text)
  const spawnsServe = text.includes('["serve", "--port"')

  if (/OPENCODE_CALLER/.test(text)) {
    result.protected.push(
      protectedFinding("vscode-internal-env-preserved", file, "Internal OPENCODE_CALLER compatibility marker remains unchanged."),
    )
  }

  if (prefersHypercode && spawnsServe) {
    result.protected.push(
      protectedFinding(
        "vscode-launch-command-hypercode",
        file,
        'VS Code spawns "hypercode serve --port ...", falling back to the opencode alias only when hypercode is not on PATH.',
      ),
    )
    return result
  }

  if (defaultsToOpenCode) {
    result.manualCheckRequired.push(
      manualFinding(
        "vscode-launch-command-open-code-visible",
        file,
        "needs-manual-check",
        "VS Code still resolves the opencode CLI before hypercode.",
        'Prefer "hypercode" and keep "opencode" only as a fallback alias.',
      ),
    )
    return result
  }

  result.manualCheckRequired.push(
    manualFinding(
      "vscode-launch-command-unknown",
      file,
      "needs-manual-check",
      "Unable to confirm the HyperCode launch command from the current source.",
      'Verify the extension spawns "hypercode serve --port ..." and only falls back to "opencode".',
    ),
  )
  return result
}

async function auditArtifactNaming(rootDir) {
  const result = emptyAudit()
  const files = [
    "docs/hypercode-binary-plugin-distribution.md",
    "sdks/vscode/script/publish",
  ]

  for (const file of files) {
    const text = await readUtf8(path.join(rootDir, file))
    if (text === undefined) continue

    const hasGoodWindows = /hypercode-windows-x64/.test(text) || !/windows-x64/.test(text)
    const hasGoodExe = /hypercode\.exe/.test(text) || !/\.exe/.test(text)
    const hasGoodVsix = /hypercode\.vsix/.test(text) || !/\.vsix/.test(text)
    const hasOldArtifactNames = /opencode-windows-x64|opencode\.exe|opencode\.vsix/.test(text)

    if (hasGoodWindows && hasGoodExe && hasGoodVsix) {
      result.protected.push(
        protectedFinding("artifact-names-hypercode", file, "Visible artifact names already use HyperCode outputs."),
      )
    }

    if (hasOldArtifactNames) {
      result.patchable.push(
        patchableFinding(
          "artifact-names-open-code",
          file,
          "Visible artifact names still contain OpenCode output names.",
          "Safe auto-patch is available for exact artifact-name fragments in this file.",
        ),
      )
    }
  }

  return result
}

async function auditConfigCompatibility(rootDir) {
  const result = emptyAudit()
  const envFile = "packages/core/src/flag/env.ts"
  const flagFile = "packages/core/src/flag/flag.ts"
  const runtimeFile = "packages/opencode/src/effect/runtime-flags.ts"
  const configFile = "packages/opencode/src/config/config.ts"
  const configPathsFile = "packages/opencode/src/config/paths.ts"

  const envText = await readUtf8(path.join(rootDir, envFile))
  const flagText = await readUtf8(path.join(rootDir, flagFile))
  const runtimeText = await readUtf8(path.join(rootDir, runtimeFile))
  const configText = await readUtf8(path.join(rootDir, configFile))
  const configPathsText = await readUtf8(path.join(rootDir, configPathsFile))

  const aliasLine = 'key.startsWith("OPENCODE_") ? `HYPERCODE_${key.slice("OPENCODE_".length)}` : undefined'
  const runtimeAliasLine = 'name.startsWith("OPENCODE_") ? `HYPERCODE_${name.slice("OPENCODE_".length)}` : undefined'
  // C-001 (17dacc365) centralized the alias in env.ts `names()`: HYPERCODE_* first, then the OPENCODE_* fallback.
  const sharedAlias = !!envText?.includes(runtimeAliasLine) && envText.includes("return alias ? [alias, name] : [name]")
  const coreUsesSharedAlias = sharedAlias && !!flagText?.includes('import { names } from "./env"')
  const runtimeUsesSharedAlias = sharedAlias && !!runtimeText?.includes('import { names } from "@opencode-ai/core/flag/env"')

  if (flagText?.includes(aliasLine) || coreUsesSharedAlias) {
    result.protected.push(
      protectedFinding("core-env-alias", flagFile, "Core flags prefer HYPERCODE_* while preserving OPENCODE_* fallback."),
    )
  } else {
    result.blocked.push(
      blockedFinding(
        "core-env-alias-missing",
        flagFile,
        "high-risk-compatibility-break",
        "Core env alias logic was not detected.",
        "Restore HYPERCODE_* primary lookup with OPENCODE_* fallback.",
      ),
    )
  }

  if (runtimeText?.includes(runtimeAliasLine) || runtimeUsesSharedAlias) {
    result.protected.push(
      protectedFinding(
        "runtime-env-alias",
        runtimeFile,
        "Runtime flags prefer HYPERCODE_* while preserving OPENCODE_* fallback.",
      ),
    )
  } else {
    result.blocked.push(
      blockedFinding(
        "runtime-env-alias-missing",
        runtimeFile,
        "high-risk-compatibility-break",
        "Runtime env alias logic was not detected.",
        "Restore HYPERCODE_* primary lookup with OPENCODE_* fallback.",
      ),
    )
  }

  if (configText?.includes('["hypercode.jsonc", "hypercode.json", "opencode.jsonc", "opencode.json", "config.json"]')) {
    result.protected.push(
      protectedFinding("config-file-priority", configFile, "Global config discovery prefers HyperCode file names before OpenCode fallbacks."),
    )
  } else {
    result.manualCheckRequired.push(
      manualFinding(
        "config-file-priority-unknown",
        configFile,
        "needs-manual-check",
        "Unable to confirm HyperCode config filenames are preferred before OpenCode fallbacks.",
        "Verify hypercode.json/jsonc are checked before opencode.json/jsonc in global config discovery.",
      ),
    )
  }

  if (configPathsText?.includes('targets: [".hypercode", ".opencode"]')) {
    result.protected.push(
      protectedFinding("config-directory-dual-support", configPathsFile, "Config directory discovery preserves .hypercode primary and .opencode fallback."),
    )
  } else {
    result.blocked.push(
      blockedFinding(
        "config-directory-dual-support-missing",
        configPathsFile,
        "high-risk-compatibility-break",
        "Expected .hypercode + .opencode directory support was not detected.",
        "Restore .hypercode primary discovery while preserving .opencode fallback.",
      ),
    )
  }

  return result
}

async function auditCliVisibleBrand(rootDir) {
  const result = emptyAudit()
  const checks = [
    {
      file: "packages/opencode/src/cli/main.ts",
      ok: (text) => text.includes('.scriptName("hypercode")') && text.includes('text.startsWith("hypercode ")'),
      visibleOldBrand: (text) => text.includes('.scriptName("opencode")') || text.includes('text.startsWith("opencode ")'),
      detail: 'CLI entrypoint shows "hypercode" in visible banner/help paths.',
      recommendation: 'Keep internal opencode compatibility markers, but switch visible CLI names to "hypercode".',
    },
    {
      file: "packages/opencode/src/temporary.ts",
      ok: (text) => text.includes('.scriptName("hypercode")'),
      visibleOldBrand: (text) => text.includes('.scriptName("opencode")'),
      detail: 'Temporary CLI entrypoint shows "hypercode" in visible help output.',
      recommendation: 'Rewrite only the visible temporary CLI script name to "hypercode".',
    },
    {
      file: "packages/opencode/src/cli/error.ts",
      ok: (text) => text.includes("HyperCode does not support MCP authentication yet.") && text.includes("hypercode models"),
      visibleOldBrand: (text) =>
        text.includes("OpenCode does not support MCP authentication yet.") || text.includes("opencode models"),
      detail: 'CLI error/help copy shows HyperCode branding.',
      recommendation: 'Rewrite only user-visible CLI help/error strings to HyperCode.',
    },
  ]

  for (const check of checks) {
    const text = await readUtf8(path.join(rootDir, check.file))
    if (text === undefined) continue

    if (check.ok(text)) {
      result.protected.push(protectedFinding("cli-visible-brand", check.file, check.detail))
      continue
    }

    if (check.visibleOldBrand(text)) {
      result.patchable.push(
        patchableFinding("cli-visible-open-code", check.file, "Visible CLI branding still contains OpenCode.", check.recommendation),
      )
      continue
    }

    result.manualCheckRequired.push(
      manualFinding("cli-visible-brand-unknown", check.file, "needs-manual-check", "Unable to confirm visible CLI branding state.", check.recommendation),
    )
  }

  return result
}

async function runSyntheticDrill() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hypercode-rebrand-"))
  await createSyntheticFixture(tempRoot)

  try {
    const dryRunResult = await runRebrand({ root: tempRoot, dryRun: true })
    const writeResult = await runRebrand({ root: tempRoot, dryRun: false })
    const verification = await verifySyntheticFixture(tempRoot, dryRunResult, writeResult)
    const ok =
      dryRunResult.status === "ok" &&
      writeResult.status === "ok" &&
      verification.ok &&
      dryRunResult.planned.length > 0 &&
      dryRunResult.manualCheckRequired.some((item) => item.id === "provider-display-name-open-code-zen") &&
      dryRunResult.manualCheckRequired.some((item) => item.id === "vscode-launch-command-open-code-visible")

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
    "docs/hypercode-rebrand-audit.md": "Manual audit doc for OpenCode compatibility.\n",
    "docs/hypercode-rebrand-report.md": "Manual report doc for OpenCode compatibility.\n",
    "docs/hypercode-binary-plugin-distribution.md": [
      "# OpenCode Binary Plugin Distribution",
      "- packages/opencode/dist/opencode-windows-x64/bin/opencode.exe",
      "- dist/opencode.vsix",
      "- Release zip/tar artifact names use `opencode-*`",
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
    "packages/opencode/src/cli/main.ts": [
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
    "packages/opencode/src/provider/provider.ts": [
      'const displayName = provider.id === "opencode" ? "OpenCode Zen" : provider.name',
      "return {",
      "  id: ProviderV2.ID.make(provider.id),",
      "  name: displayName,",
      "}",
    ].join("\n"),
    "packages/core/src/flag/env.ts": [
      "export function names(name: string) {",
      '  const alias = name.startsWith("OPENCODE_") ? `HYPERCODE_${name.slice("OPENCODE_".length)}` : undefined',
      "  return alias ? [alias, name] : [name]",
      "}",
    ].join("\n"),
    "packages/core/src/flag/flag.ts": [
      'import { names } from "./env"',
      "function env(key: string) {",
      "  return names(key).map((name) => process.env[name]).find((value) => value !== undefined)",
      "}",
    ].join("\n"),
    "packages/opencode/src/effect/runtime-flags.ts": [
      'import { names } from "@opencode-ai/core/flag/env"',
      "const string = (name: string) => names(name).map((key) => Config.string(key))",
    ].join("\n"),
    "packages/opencode/src/config/config.ts": [
      'const candidates = ["hypercode.jsonc", "hypercode.json", "opencode.jsonc", "opencode.json", "config.json"]',
    ].join("\n"),
    "packages/opencode/src/config/paths.ts": [
      'targets: [".hypercode", ".opencode"]',
    ].join("\n"),
    "sdks/vscode/package.json": JSON.stringify(
      {
        name: "opencode",
        displayName: "OpenCode",
        description: "opencode for VS Code",
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
    "sdks/vscode/script/publish": [
      "#!/usr/bin/env bash",
      'vsce package -o dist/opencode.vsix',
      'vsce publish --packagePath dist/opencode.vsix',
      'npx ovsx publish dist/opencode.vsix -p "$OPENVSX_TOKEN"',
    ].join("\n"),
    "sdks/vscode/src/core/server.ts": [
      "export function resolveOpencodeCommand() {",
      '  return detectAvailableCommand(["opencode"]) ?? "opencode"',
      "}",
      'const env = { ...process.env, OPENCODE_CALLER: "vscode-ui" }',
      'cp.spawn(command, ["serve", "--port", String(port), "--hostname", "127.0.0.1"], { env })',
    ].join("\n"),
  }

  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(rootDir, relative)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content + (content.endsWith("\n") ? "" : "\n"))
  }
}

async function verifySyntheticFixture(rootDir, dryRunResult, writeResult) {
  const read = async (relative) => fs.readFile(path.join(rootDir, relative), "utf8")
  const appI18n = await read("packages/app/src/i18n/en.ts")
  const desktopI18n = await read("packages/desktop/src/renderer/i18n/en.ts")
  const cliError = await read("packages/opencode/src/cli/error.ts")
  const cliIndex = await read("packages/opencode/src/cli/main.ts")
  const temporary = await read("packages/opencode/src/temporary.ts")
  const provider = await read("packages/opencode/src/provider/provider.ts")
  const vscodePackage = JSON.parse(await read("sdks/vscode/package.json"))
  const vscodePublish = await read("sdks/vscode/script/publish")
  const vscodeServer = await read("sdks/vscode/src/core/server.ts")
  const docsBinary = await read("docs/hypercode-binary-plugin-distribution.md")
  const readme = await read("README.md")

  const checks = [
    check("app-out-of-delivery-untouched", appI18n.includes("OpenCode default provider")),
    check("desktop-out-of-delivery-untouched", desktopI18n.includes("latest version of OpenCode")),
    check(
      "dry-run-out-of-delivery-skipped",
      dryRunResult.skipped.some((item) => item.file === "packages/app/src/i18n/en.ts" && item.reason === "out-of-delivery"),
    ),
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
    check("provider-id-protected", provider.includes("ProviderV2.ID.make(provider.id)")),
    check("provider-display-name-manual", provider.includes('const displayName = provider.id === "opencode" ? "OpenCode Zen" : provider.name')),
    check("vscode-name", vscodePackage.name === "hypercode"),
    check("vscode-display-name", vscodePackage.displayName === "HyperCode"),
    check("vscode-description", vscodePackage.description === "HyperCode for VS Code"),
    check("vscode-command-id-protected", vscodePackage.contributes.commands[0].command === "opencode.openTerminal"),
    check("vscode-title-rewritten", vscodePackage.contributes.commands[0].title === "Open HyperCode"),
    check("vscode-repo-url-protected", vscodePackage.repository.url === "https://github.com/anomalyco/opencode"),
    check("publish-vsix-rewritten", vscodePublish.includes("dist/hypercode.vsix")),
    check("artifact-doc-rewritten", docsBinary.includes("hypercode-windows-x64") && docsBinary.includes("hypercode.exe") && docsBinary.includes("hypercode.vsix")),
    check("manual-readme-protected", readme.includes("https://github.com/anomalyco/opencode")),
    check("vscode-launch-command-manual", vscodeServer.includes('?? "opencode"')),
    check(
      "dry-run-provider-manual-detected",
      dryRunResult.manualCheckRequired.some((item) => item.id === "provider-display-name-open-code-zen"),
    ),
    check(
      "dry-run-vscode-launch-manual-detected",
      dryRunResult.manualCheckRequired.some((item) => item.id === "vscode-launch-command-open-code-visible"),
    ),
    check(
      "dry-run-artifact-patchable-detected",
      dryRunResult.patchable.some((item) => item.file === "docs/hypercode-binary-plugin-distribution.md"),
    ),
    check(
      "dry-run-protected-config-detected",
      dryRunResult.protected.some((item) => item.id === "config-directory-dual-support"),
    ),
    check(
      "dry-run-shared-env-alias-detected",
      dryRunResult.protected.some((item) => item.id === "core-env-alias") &&
        dryRunResult.protected.some((item) => item.id === "runtime-env-alias"),
    ),
    check("write-kept-provider-manual", writeResult.written.includes("packages/opencode/src/provider/provider.ts") === false),
    check("write-kept-vscode-launch-manual", writeResult.written.includes("sdks/vscode/src/core/server.ts") === false),
    check("write-kept-app-out-of-delivery", writeResult.written.includes("packages/app/src/i18n/en.ts") === false),
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
  if ("blocked" in result) process.stdout.write(`Blocked entries: ${result.blocked.length}\n`)
  if ("protected" in result) process.stdout.write(`Protected entries: ${result.protected.length}\n`)
  if ("manualCheckRequired" in result) {
    process.stdout.write(`Manual-check entries: ${result.manualCheckRequired.length}\n`)
  }
  if ("patchable" in result) process.stdout.write(`Patchable entries: ${result.patchable.length}\n`)
  if ("synthetic-drill" === result.mode) process.stdout.write(`Synthetic drill: ${result.ok ? "passed" : "failed"}\n`)
}
