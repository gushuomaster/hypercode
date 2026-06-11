import type { CommandInfo, SessionMessage, TextPart } from "../../../core/sdk"

export type CommandPromptInvocation = {
  command: string
  arguments: string
}

export type CommandPromptCatalog = Record<string, CommandPromptInvocation>

const MAX_COMMAND_PROMPT_ENTRIES = 40
const MAX_PREVIEW_LINES = 10
const MAX_PREVIEW_CHARS = 420
const TEMPLATE_DYNAMIC_TOKEN = "\u0000"

export function normalizeCommandPromptText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim()
    : ""
}

export function fingerprintCommandPromptText(value: string) {
  const normalized = normalizeCommandPromptText(value)
  if (!normalized) {
    return ""
  }

  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${normalized.length}:${(hash >>> 0).toString(36)}`
}

export function isCompactCommandPromptText(value: string) {
  const normalized = normalizeCommandPromptText(value)
  if (!normalized || normalized.startsWith("/")) {
    return false
  }

  const lines = normalized.split("\n")
  const headingCount = lines.filter((line) => /^\s{0,3}#{1,6}\s/.test(line)).length
  const bulletCount = lines.filter((line) => /^\s{0,3}[-*+]\s/.test(line)).length
  const numberedCount = lines.filter((line) => /^\s{0,3}\d+\.\s/.test(line)).length
  const paragraphCount = normalized.split(/\n\s*\n/).filter((part) => part.trim().length > 0).length

  if (normalized.length < 160) {
    return false
  }

  if (headingCount >= 2) {
    return true
  }

  if (headingCount >= 1 && (bulletCount + numberedCount >= 2 || paragraphCount >= 4)) {
    return true
  }

  return normalized.length >= 280 && (bulletCount + numberedCount >= 4 || paragraphCount >= 5)
}

export function findCommandPromptInvocation(text: string, catalog: CommandPromptCatalog, commands: CommandInfo[] = []) {
  const templateMatch = matchCommandPromptTemplate(text, commands)
  if (templateMatch) {
    return templateMatch
  }

  const fingerprint = fingerprintCommandPromptText(text)
  if (!fingerprint) {
    return undefined
  }

  const invocation = catalog[fingerprint]
  if (!invocation) {
    return undefined
  }

  return shouldTrackCommandPromptInvocation(invocation.command, commands)
    ? invocation
    : undefined
}

export function commandPromptLabel(invocation: CommandPromptInvocation) {
  const command = invocation.command.trim()
  const args = invocation.arguments.trim()
  return args ? `${command} ${args}` : command
}

export function previewCommandPromptText(text: string) {
  const normalized = normalizeCommandPromptText(text)
  if (!normalized) {
    return ""
  }

  const lines = normalized.split("\n")
  const selected = lines.slice(0, MAX_PREVIEW_LINES)
  let preview = selected.join("\n").trim()
  if (preview.length > MAX_PREVIEW_CHARS) {
    preview = `${preview.slice(0, MAX_PREVIEW_CHARS).trimEnd()}...`
  } else if (lines.length > selected.length) {
    preview = `${preview.trimEnd()}...`
  }

  return preview
}

export function captureCommandPromptInvocations(
  previous: SessionMessage[],
  next: SessionMessage[],
  pending: CommandPromptInvocation[],
  catalog: CommandPromptCatalog,
) {
  if (pending.length === 0 || next.length === 0) {
    return { pending, catalog }
  }

  const previousIds = new Set(previous.map((message) => message.info.id))
  const newUserMessages = next.filter((message) => message.info.role === "user" && !previousIds.has(message.info.id))
  if (newUserMessages.length === 0) {
    return { pending, catalog }
  }

  let remaining = pending
  let nextCatalog = catalog
  let changed = false

  for (const message of newUserMessages) {
    const invocation = remaining[0]
    if (!invocation) {
      break
    }

    remaining = remaining.slice(1)
    changed = true

    const text = primaryUserText(message)?.text || ""
    if (!isCompactCommandPromptText(text)) {
      continue
    }

    const fingerprint = fingerprintCommandPromptText(text)
    if (!fingerprint) {
      continue
    }

    const existing = nextCatalog[fingerprint]
    if (existing?.command === invocation.command && existing.arguments === invocation.arguments) {
      continue
    }

    nextCatalog = rememberCommandPromptInvocation(nextCatalog, fingerprint, invocation)
  }

  return changed ? { pending: remaining, catalog: nextCatalog } : { pending, catalog }
}

export function consumeFailedCommandPrompt(pending: CommandPromptInvocation[]) {
  return pending.length > 0 ? pending.slice(1) : pending
}

export function shouldTrackCommandPromptInvocation(commandName: string, commands: CommandInfo[]) {
  const known = commands.find((command) => command.name === commandName)
  return known?.source !== "skill"
}

function primaryUserText(message: SessionMessage) {
  return message.parts.find((part): part is TextPart => part.type === "text" && typeof part.text === "string" && !part.synthetic && !part.ignored)
}

function rememberCommandPromptInvocation(
  catalog: CommandPromptCatalog,
  fingerprint: string,
  invocation: CommandPromptInvocation,
) {
  const next = {
    ...catalog,
    [fingerprint]: invocation,
  }

  const entries = Object.entries(next)
  if (entries.length <= MAX_COMMAND_PROMPT_ENTRIES) {
    return next
  }

  return Object.fromEntries(entries.slice(entries.length - MAX_COMMAND_PROMPT_ENTRIES))
}

function matchCommandPromptTemplate(text: string, commands: CommandInfo[]) {
  const normalized = normalizeCommandPromptText(text)
  if (!normalized) {
    return undefined
  }

  for (const command of commands) {
    if (command.source === "skill") {
      continue
    }

    const template = normalizeCommandPromptText(command.template || "")
    if (!template) {
      continue
    }

    if (normalized === template || matchRenderedTemplate(normalized, template)) {
      return {
        command: command.name,
        arguments: "",
      }
    }
  }
}

function matchRenderedTemplate(rendered: string, template: string) {
  const canonicalRendered = canonicalizeCommandPromptForMatch(rendered)
  const canonicalTemplate = canonicalizeCommandPromptForMatch(template)
  if (canonicalRendered === canonicalTemplate) {
    return true
  }

  const anchors = templateAnchors(template)
  if (anchors.length === 0) {
    return false
  }

  let cursor = 0
  for (const anchor of anchors) {
    const next = canonicalRendered.indexOf(anchor, cursor)
    if (next < 0) {
      return false
    }
    cursor = next + anchor.length
  }

  return true
}

function canonicalizeCommandPromptForMatch(value: string) {
  return normalizeCommandPromptText(value)
    .replace(/\$(?:ARGUMENTS|\d+)/g, "")
    .replace(/!\`[^`]*\`/g, "")
    .replace(/@\S+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function templateAnchors(template: string) {
  return canonicalizeTemplateSkeleton(template)
    .split(TEMPLATE_DYNAMIC_TOKEN)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12)
}

function canonicalizeTemplateSkeleton(value: string) {
  return normalizeCommandPromptText(value)
    .replace(/!\`[^`]*\`/g, TEMPLATE_DYNAMIC_TOKEN)
    .replace(/\$(?:ARGUMENTS|\d+)/g, TEMPLATE_DYNAMIC_TOKEN)
    .replace(/@\S+/g, TEMPLATE_DYNAMIC_TOKEN)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
