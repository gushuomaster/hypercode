import { deriveProductCommandCatalog, type ProductCommandEntry, type ProductCommandInput } from "@opencode-ai/product"

export function toVsCodeProductCommands(inputs: ProductCommandInput[]): ProductCommandEntry[] {
  return deriveProductCommandCatalog(inputs)
}
