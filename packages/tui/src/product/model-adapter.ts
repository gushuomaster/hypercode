import { deriveModelCatalog, projectProductAgents, projectProductProviders, type ModelCatalogInput, type ProductAgent, type ProductProvider, type ProductProviderInput } from "@opencode-ai/product"

export function toProductProviders(providers: ProductProviderInput[]): ProductProvider[] {
  return projectProductProviders(providers)
}

export function toProductAgents(agents: ProductAgent[]): ProductAgent[] {
  return projectProductAgents(agents)
}

export function toTuiModelCatalog(input: Omit<ModelCatalogInput, "providers"> & { providers: ProductProviderInput[] }) {
  return deriveModelCatalog({
    ...input,
    providers: toProductProviders(input.providers),
  })
}
