import { deriveProductThemeCatalog, type ProductThemeEntry } from "@opencode-ai/product"
import type { ThemeJson } from "../theme"

export function toProductThemes(themes: Record<string, ThemeJson>, selected?: string): ProductThemeEntry[] {
  return deriveProductThemeCatalog(Object.keys(themes).map((id) => ({ id, kind: "theme" as const })), { theme: selected })
}
