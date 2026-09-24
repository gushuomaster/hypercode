import { deriveProductCommandCatalog, type ProductCommandEntry, type ProductCommandInput } from "@opencode-ai/product"

export function toTuiProductCommands(inputs: ProductCommandInput[]): ProductCommandEntry[] {
  return deriveProductCommandCatalog(inputs)
}
