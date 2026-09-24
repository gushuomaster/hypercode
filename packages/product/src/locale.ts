export type ProductLocale = "en" | "zh"

export type ProductLocaleState = {
  locale: ProductLocale
  available: ProductLocale[]
}

export function normalizeProductLocale(value?: string): ProductLocale {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function deriveProductLocaleState(input: { requested?: string; available?: string[] }): ProductLocaleState {
  const normalized = (input.available ?? ["en", "zh"]).map((value): ProductLocale => normalizeProductLocale(value))
  const available = Array.from(new Set<ProductLocale>(normalized)).sort(localeOrder)
  const normalizedAvailable: ProductLocale[] = available.length > 0 ? available : ["en", "zh"]
  const requested = normalizeProductLocale(input.requested)
  return {
    locale: normalizedAvailable.includes(requested) ? requested : normalizedAvailable[0],
    available: normalizedAvailable,
  }
}

function localeOrder(left: ProductLocale, right: ProductLocale) {
  return left === right ? 0 : left === "en" ? -1 : 1
}
