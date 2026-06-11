import type { SkillCatalogEntry } from "../../bridge/types"

const SKILL_CONTENT_WRAPPER = /^<skill_content\s+name="([^"]+)">[\s\S]*<\/skill_content>\s*$/i
const SKILL_HEADING = /^# Skill:\s*(.+)$/im

export type SkillInvocationTextMatch = {
  name: string
  remainder: string
}

export function normalizeSkillText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim()
}

export function matchSkillInvocationText(text: string): SkillInvocationTextMatch | undefined {
  const normalized = text.replace(/\r\n?/g, "\n").trimStart()
  if (!normalized.startsWith("<skill_content")) {
    return
  }

  const open = normalized.match(/^<skill_content\s+name="([^"]+)">/i)
  if (!open?.[1]) {
    return
  }

  const closeIndex = normalized.indexOf("</skill_content>")
  if (closeIndex < 0) {
    return
  }

  const remainder = normalized.slice(closeIndex + "</skill_content>".length).trimStart()
  return {
    name: open[1].trim(),
    remainder,
  }
}

export function matchSkillInvocationContent(text: string, catalog: SkillCatalogEntry[]): SkillInvocationTextMatch | undefined {
  const normalized = normalizeSkillText(text)
  if (!normalized) {
    return
  }

  for (const skill of catalog) {
    const content = normalizeSkillText(skill.content)
    if (!content || normalized.length < content.length || !normalized.startsWith(content)) {
      continue
    }

    const suffix = normalized.slice(content.length)
    if (suffix && !/^\s/.test(suffix)) {
      continue
    }

    return {
      name: skill.name,
      remainder: suffix.trimStart(),
    }
  }
}

export function findSkillInvocationMatch(text: string, catalog: SkillCatalogEntry[] = []) {
  return matchSkillInvocationText(text) || matchSkillInvocationContent(text, catalog)
}

export function extractSkillInvocationName(output: string, fallbackName = "") {
  const normalized = normalizeSkillText(output)
  if (!normalized) {
    return fallbackName.trim()
  }

  const wrapped = normalized.match(SKILL_CONTENT_WRAPPER)
  if (wrapped?.[1]?.trim()) {
    return wrapped[1].trim()
  }

  const heading = normalized.match(SKILL_HEADING)
  if (heading?.[1]?.trim()) {
    return heading[1].trim()
  }

  return fallbackName.trim()
}

export function isWrappedSkillInvocationOutput(output: string) {
  return SKILL_CONTENT_WRAPPER.test(normalizeSkillText(output))
}

export function compactSkillInvocationText(text: string, catalog: SkillCatalogEntry[] = []) {
  const match = findSkillInvocationMatch(text, catalog)
  if (!match) {
    return text
  }

  if (!match.remainder) {
    return `/${match.name} `
  }

  return `/${match.name}\n\n${match.remainder}`
}
