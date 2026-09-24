export type ProductCommandAvailability = "available" | "unsupported"

export type ProductCommandInput = {
  id: string
  name: string
  title?: string
  description?: string
  category?: string
  source?: string
  hidden?: boolean
  enabled?: boolean
}

export type ProductCommandEntry = {
  id: string
  name: string
  title: string
  description?: string
  category?: string
  source?: string
  availability: ProductCommandAvailability
}

export function deriveProductCommandCatalog(inputs: ProductCommandInput[]): ProductCommandEntry[] {
  const entries = new Map<string, ProductCommandEntry>()
  for (const input of inputs) {
    const id = input.id.trim()
    const name = input.name.trim()
    if (!id || !name || input.hidden) continue
    if (entries.has(id)) continue
    entries.set(id, {
      id,
      name,
      title: input.title?.trim() || name,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.category?.trim() ? { category: input.category.trim() } : {}),
      ...(input.source?.trim() ? { source: input.source.trim() } : {}),
      availability: input.enabled === false ? "unsupported" : "available",
    })
  }
  return [...entries.values()].sort(compareCommands)
}

function compareCommands(left: ProductCommandEntry, right: ProductCommandEntry) {
  return (left.category ?? "").localeCompare(right.category ?? "")
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
}
