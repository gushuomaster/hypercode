import { deriveProductHelpCatalog, type ProductHelpEntry } from "@opencode-ai/product"

export function toTuiProductHelpTopics(): ProductHelpEntry[] {
  return deriveProductHelpCatalog([{ id: "commands", titleKey: "dialog.help.title", descriptionKey: "dialog.help.message" }])
}
