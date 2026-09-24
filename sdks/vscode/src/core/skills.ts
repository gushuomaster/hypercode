import type { SkillCatalogEntry } from "../bridge/types"
import type { Client } from "./sdk"
import os from "node:os"
import { deriveProductSkillCatalog } from "@opencode-ai/product"

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
    const entries = (result.data ?? []).flatMap((entry) => normalizeOfficialSkillEntry(entry))
    const catalog = deriveProductSkillCatalog({
      skills: entries,
      workspaceRoots: [workspaceDir],
      home: os.homedir(),
    })
    return catalog.items.flatMap((item) => {
      const entry = entries.find((candidate) => candidate.name === item.name && candidate.location === item.location)
      if (!entry) return []
      return [{
        ...entry,
        scope: item.scope,
        textKey: item.textKey,
        overrides: item.overrides,
      }]
    })
  } catch {
    return []
  }
}

function normalizeOfficialSkillEntry(entry: OfficialSkillEntry) {
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
