import { deriveProductSkillCatalog, type ProductSkillCatalogInput } from "@opencode-ai/product"

export function toTuiSkillCatalog(input: ProductSkillCatalogInput) {
  return deriveProductSkillCatalog(input)
}
