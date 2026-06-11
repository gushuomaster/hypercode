import type { SkillCatalogEntry } from "../bridge/types"
import type { Client } from "./sdk"

type OfficialSkillEntry = {
  name?: string
  content?: string
  location?: string
}

export async function loadSkillCatalog(workspaceDir: string, sdk: Pick<Client, "app">): Promise<SkillCatalogEntry[]> {
  try {
    const result = await sdk.app.skills({
      directory: workspaceDir,
    })
    return dedupeCatalog((result.data ?? []).flatMap((entry) => normalizeOfficialSkillEntry(entry)))
  } catch {
    return []
  }
}

function normalizeOfficialSkillEntry(entry: OfficialSkillEntry): SkillCatalogEntry[] {
  const name = entry.name?.trim()
  const content = stripFrontmatter(entry.content ?? "").trim()
  const location = entry.location?.trim()
  if (!name || !content) {
    return []
  }

  return [{
    name,
    content,
    location: location || undefined,
  }]
}

function stripFrontmatter(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n")
  if (!normalized.startsWith("---\n")) {
    return normalized
  }

  const end = normalized.indexOf("\n---\n", 4)
  if (end < 0) {
    return normalized
  }

  return normalized.slice(end + 5)
}

function dedupeCatalog(entries: SkillCatalogEntry[]) {
  const seen = new Set<string>()
  const result: SkillCatalogEntry[] = []

  for (const entry of entries) {
    const key = `${entry.name}\u0000${entry.content}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(entry)
  }

  return result.sort((a, b) => b.content.length - a.content.length || a.name.localeCompare(b.name))
}
