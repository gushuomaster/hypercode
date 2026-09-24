export type ProductThemeKind = "theme" | "color"

export type ProductThemeInput = {
  id: string
  kind: ProductThemeKind
  order?: number
  enabled?: boolean
}

export type ProductThemeEntry = {
  id: string
  kind: ProductThemeKind
  order: number
  enabled: boolean
  selected: boolean
}

export type ProductThemeSelection = {
  theme?: string
  color?: string
}

export function deriveProductThemeCatalog(inputs: ProductThemeInput[], selection: ProductThemeSelection = {}): ProductThemeEntry[] {
  const entries = new Map<string, ProductThemeEntry>()
  for (const input of inputs) {
    const id = input.id.trim()
    if (!id || input.enabled === false) continue
    const key = `${input.kind}:${id}`
    if (entries.has(key)) continue
    entries.set(key, {
      id,
      kind: input.kind,
      order: input.order ?? Number.MAX_SAFE_INTEGER,
      enabled: true,
      selected: input.kind === "theme" ? selection.theme === id : selection.color === id,
    })
  }
  return [...entries.values()].sort(compareThemes)
}

export function deriveProductThemeSelection(input: { entries: ProductThemeInput[] | ProductThemeEntry[]; selection: ProductThemeSelection }): ProductThemeSelection {
  const catalog = deriveProductThemeCatalog(input.entries, input.selection)
  return {
    theme: selectTheme(catalog, "theme", input.selection.theme),
    color: selectTheme(catalog, "color", input.selection.color),
  }
}

function selectTheme(entries: ProductThemeEntry[], kind: ProductThemeKind, requested?: string) {
  const matching = entries.filter((entry) => entry.kind === kind && entry.enabled)
  if (requested && matching.some((entry) => entry.id === requested)) return requested
  return matching[0]?.id
}

function compareThemes(left: ProductThemeEntry, right: ProductThemeEntry) {
  return (left.kind === right.kind ? 0 : left.kind === "theme" ? -1 : 1)
    || left.order - right.order
    || left.id.localeCompare(right.id)
}
