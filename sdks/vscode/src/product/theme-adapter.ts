import { deriveProductThemeCatalog, type ProductThemeEntry } from "@opencode-ai/product"
import type { PanelColorScheme, PanelTheme } from "../core/settings"

export function toVsCodeProductThemes(theme: PanelTheme, colorScheme: PanelColorScheme): ProductThemeEntry[] {
  return deriveProductThemeCatalog([
    { id: "classic", kind: "theme", order: 0 },
    { id: "codex", kind: "theme", order: 1 },
    { id: "claude", kind: "theme", order: 2 },
    { id: "default", kind: "color", order: 0 },
    { id: "nocturne", kind: "color", order: 1 },
    { id: "orchid", kind: "color", order: 2 },
    { id: "verdant", kind: "color", order: 3 },
    { id: "solar", kind: "color", order: 4 },
    { id: "graphite", kind: "color", order: 5 },
    { id: "ember", kind: "color", order: 6 },
  ], { theme, color: colorScheme })
}
