export type ProductModelRef = {
  providerID: string
  modelID: string
}

export type ProductModel = {
  id: string
  name?: string
  free?: boolean
  releaseDate?: string | number
  status?: "active" | "deprecated" | string
  variants?: Record<string, unknown>
  reasoning?: boolean
  toolCall?: boolean
  inputModalities?: string[]
  contextLimit?: number
}

export type ProductProvider = {
  id: string
  name?: string
  models: ProductModel[]
}

export type ProductAgent = {
  name: string
  mode: "primary" | "subagent" | "all"
  hidden?: boolean
  model?: ProductModelRef
  variant?: string
}

export type ProductModelItem = {
  id: string
  provider: ProductProvider
  model: ProductModel
  modelRef: ProductModelRef
  selected: boolean
  favorite: boolean
  variant?: string
  variantOptions: string[]
}

export type ProductModelSection = {
  id: string
  kind: "favorites" | "recent" | "configured" | "current" | "free" | "provider" | "search"
  providerID?: string
  items: ProductModelItem[]
  collapsedCount?: number
}

export type ModelCatalog = {
  sections: ProductModelSection[]
  searchItems: ProductModelItem[]
}

export type ModelCatalogInput = {
  providers: ProductProvider[]
  favorites: ProductModelRef[]
  recents: ProductModelRef[]
  configured: ProductModelRef[]
  current?: ProductModelRef
  variants?: Record<string, string | undefined>
  query?: string
}

export type ComposerInput = {
  providers: ProductProvider[]
  agents: ProductAgent[]
  defaultAgent?: string
  agentMode?: "build" | "plan"
  messagesExist?: boolean
  configuredModel?: ProductModelRef
  providerDefaults?: Record<string, string>
  recentModels?: ProductModelRef[]
  modelOverrides?: Record<string, ProductModelRef>
  mentionAgentOverride?: string
  agentOverride?: string
  modelVariants?: Record<string, string | undefined>
}

export type ComposerSelection = {
  agent?: string
  model?: ProductModelRef
  variant?: string
}
