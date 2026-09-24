export type ProductHelpAvailability = "available" | "unsupported"

export type ProductHelpInput = {
  id: string
  titleKey: string
  descriptionKey?: string
  order?: number
  availability?: ProductHelpAvailability
}

export type ProductHelpEntry = {
  id: string
  titleKey: string
  descriptionKey?: string
  order: number
  availability: ProductHelpAvailability
}

export function deriveProductHelpCatalog(inputs: ProductHelpInput[]): ProductHelpEntry[] {
  const entries = new Map<string, ProductHelpEntry>()
  for (const input of inputs) {
    const id = input.id.trim()
    const titleKey = input.titleKey.trim()
    if (!id || !titleKey || entries.has(id)) continue
    entries.set(id, {
      id,
      titleKey,
      ...(input.descriptionKey?.trim() ? { descriptionKey: input.descriptionKey.trim() } : {}),
      order: input.order ?? Number.MAX_SAFE_INTEGER,
      availability: input.availability ?? "available",
    })
  }
  return [...entries.values()].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}
