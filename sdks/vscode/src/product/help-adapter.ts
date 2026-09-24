import { deriveProductHelpCatalog, type ProductHelpEntry } from "@opencode-ai/product"

export function toVsCodeProductHelpTopics(): ProductHelpEntry[] {
  return deriveProductHelpCatalog([{ id: "commands", titleKey: "help.commands", availability: "unsupported" }])
}
