import type { ProductTextKey } from "./text"

export type ProductSkillScope = "project" | "global" | "builtin" | "external"

export type ProductSkillInput = {
  name: string
  description?: string
  location?: string
}

export type ProductSkillCatalogInput = {
  skills: ProductSkillInput[]
  workspaceRoots: string[]
  home?: string
}

export type ProductSkillItem = ProductSkillInput & {
  scope: ProductSkillScope
  textKey: ProductTextKey
  overrides: ProductSkillScope[]
}

export type ProductSkillGroup = {
  scope: ProductSkillScope
  textKey: ProductTextKey
  items: ProductSkillItem[]
}

export type ProductSkillCatalog = {
  items: ProductSkillItem[]
  groups: ProductSkillGroup[]
}

const scopes = ["project", "global", "builtin", "external"] as const
const precedence = ["project", "global", "external", "builtin"] as const

export function deriveProductSkillCatalog(input: ProductSkillCatalogInput): ProductSkillCatalog {
  const workspaceRoots = input.workspaceRoots.map(normalizePath).filter(Boolean)
  const home = input.home ? normalizePath(input.home) : undefined
  const candidates = input.skills.map((skill) => ({
    ...skill,
    scope: classifySkill(skill.location, workspaceRoots, home),
  }))
  const names = [...new Set(candidates.map((skill) => skill.name))].sort(compareName)
  const selected = names.map((name) => {
    const matches = candidates
      .filter((skill) => skill.name === name)
      .sort((a, b) => precedence.indexOf(a.scope) - precedence.indexOf(b.scope) || compareLocation(b.location, a.location))
    const winner = matches[0]
    return {
      name: winner.name,
      ...(winner.description === undefined ? {} : { description: winner.description }),
      ...(winner.location === undefined ? {} : { location: winner.location }),
      scope: winner.scope,
      textKey: textKey(winner.scope),
      overrides: precedence.filter((scope) => scope !== winner.scope && matches.some((item) => item.scope === scope)),
    } satisfies ProductSkillItem
  })
  return groupSkillItems(selected)
}

export function mergeProductSkillCatalog(catalog: Pick<ProductSkillCatalog, "items">, skills: ProductSkillInput[]): ProductSkillCatalog {
  const names = new Set(catalog.items.map((item) => item.name))
  const additions = deriveProductSkillCatalog({
    skills: skills.filter((skill) => !names.has(skill.name)),
    workspaceRoots: [],
  }).items
  return groupSkillItems([...catalog.items, ...additions])
}

function groupSkillItems(selected: ProductSkillItem[]): ProductSkillCatalog {
  const groups = scopes.flatMap((scope) => {
    const items = selected.filter((item) => item.scope === scope).sort((a, b) => compareName(a.name, b.name))
    if (items.length === 0) return []
    return [{ scope, textKey: textKey(scope), items }]
  })
  return {
    items: groups.flatMap((group) => group.items),
    groups,
  }
}

function classifySkill(location: string | undefined, workspaceRoots: string[], home: string | undefined): ProductSkillScope {
  if (location === "<built-in>") return "builtin"
  if (!location || /^[a-z][a-z0-9+.-]*:\/\//i.test(location)) return "external"
  const normalized = normalizePath(location)
  if (workspaceRoots.some((root) => containsPath(root, normalized))) return "project"
  if (home && containsPath(home, normalized)) return "global"
  return "external"
}

function normalizePath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "")
  if (/^[a-z]:\//i.test(normalized)) return normalized.toLowerCase()
  return normalized
}

function containsPath(root: string, value: string) {
  return value === root || value.startsWith(root + "/")
}

function compareName(a: string, b: string) {
  return a.localeCompare(b, "en", { sensitivity: "base" }) || a.localeCompare(b, "en")
}

function compareLocation(a: string | undefined, b: string | undefined) {
  return normalizePath(a ?? "").localeCompare(normalizePath(b ?? ""), "en")
}

function textKey(scope: ProductSkillScope): ProductTextKey {
  return `skill.scope.${scope}`
}
