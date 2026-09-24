import type {
  ModelCatalog,
  ModelCatalogInput,
  ProductAgent,
  ProductModel,
  ProductModelItem,
  ProductModelRef,
  ProductModelSection,
  ProductProvider,
} from "./types"

export type ProductProviderInput = {
  id: string
  name?: string
  models?: Record<string, {
    id: string
    name?: string
    cost?: { input?: number }
    release_date?: string
    status?: string
    variants?: Record<string, unknown>
    reasoning?: boolean
    tool_call?: boolean
    capabilities?: { reasoning?: boolean; input?: Record<string, boolean> }
    modalities?: { input?: string[] }
    limit?: { context?: number }
  }>
}

export function projectProductProviders(providers: ProductProviderInput[]): ProductProvider[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: Object.values(provider.models ?? {}).map((model) => ({
      id: model.id,
      name: model.name,
      free: provider.id === "opencode" && (!model.cost || model.cost.input === 0),
      releaseDate: model.release_date,
      status: model.status,
      variants: model.variants,
      reasoning: model.reasoning ?? model.capabilities?.reasoning,
      toolCall: model.tool_call,
      inputModalities: model.capabilities?.input
        ? Object.entries(model.capabilities.input).filter(([, enabled]) => enabled).map(([input]) => input)
        : model.modalities?.input,
      contextLimit: model.limit?.context,
    })),
  }))
}

export function projectProductAgents(agents: ProductAgent[]): ProductAgent[] {
  return agents.map((agent) => ({
    name: agent.name,
    mode: agent.mode,
    ...(agent.hidden === undefined ? {} : { hidden: agent.hidden }),
    ...(agent.model ? { model: agent.model } : {}),
    ...(agent.variant ? { variant: agent.variant } : {}),
  }))
}

export const MODELS_PER_PROVIDER = 5

const freeModelOrder = [
  "muse-spark-1.3-contributor-free",
  "mimo-v2.5-free",
  "kimi-k2.5-free",
  "mimo-v2-omni-free",
  "qwen3.6-plus-free",
  "minimax-m3-free",
  "glm-5-free",
  "deepseek-v4-flash-free",
  "nemotron-3-ultra-free",
  "muse-spark-1.2-contributor-free",
  "x-preview-f-free",
  "minimax-m2.5-free",
  "mimo-v2-pro-free",
  "glm-4.7-free",
  "nemotron-3-super-free",
  "nemotron-3.5-lightning-free",
  "minimax-m2.1-free",
  "longcat-2.0-free",
  "hy3-free",
  "hy3-preview-free",
  "north-mini-code-free",
  "grok-code",
  "ring-2.6-1t-free",
  "mimo-v2-flash-free",
  "trinity-large-preview-free",
  "big-pickle",
  "ling-3.0-flash-fin-free",
  "ling-3.0-flash-free",
  "ling-2.6-flash-free",
  "ling-3.0-tiny-free",
  "laguna-s-2.1-free",
]

const freeModelRank = new Map(freeModelOrder.map((id, index) => [id, freeModelOrder.length - index]))

export function deriveModelCatalog(input: ModelCatalogInput): ModelCatalog {
  const query = input.query?.trim().toLowerCase() ?? ""
  const providers = input.providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.status !== "deprecated"),
    }))
    .sort(
      (left, right) =>
        Number(left.id !== "opencode") - Number(right.id !== "opencode") ||
        (left.name ?? left.id).localeCompare(right.name ?? right.id),
    )
  const lookup = new Map(providers.flatMap((provider) => provider.models.map((model) => [modelKey({ providerID: provider.id, modelID: model.id }), { provider, model }] as const)))
  const pinned = new Set([...input.favorites, ...input.recents, ...input.configured, ...(input.current ? [input.current] : [])].map(modelKey))
  const favoriteKeys = new Set(input.favorites.map(modelKey))
  const seen = new Set<string>()

  const buildItem = (modelRef: ProductModelRef): ProductModelItem | undefined => {
    const match = lookup.get(modelKey(modelRef))
    if (!match) return undefined
    const key = modelKey(modelRef)
    return {
      id: key,
      provider: match.provider,
      model: match.model,
      modelRef: { providerID: match.provider.id, modelID: match.model.id },
      selected: sameModelRef(modelRef, input.current),
      favorite: favoriteKeys.has(key),
      variant: input.variants?.[key],
      variantOptions: Object.keys(match.model.variants ?? {}),
    }
  }

  const pushSection = (section: Omit<ProductModelSection, "items">, refs: ProductModelRef[]) => {
    const items = refs
      .map(buildItem)
      .filter((item): item is ProductModelItem => !!item)
      .filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
    if (items.length > 0) sections.push({ ...section, items })
  }

  const sections: ProductModelSection[] = []
  const searchItems = providers
    .flatMap((provider) => provider.models.map((model) => ({ provider, model })))
    .sort((left, right) => Number(!left.model.free) - Number(!right.model.free) || compareModels(left.model, right.model))
    .map(({ provider, model }) => buildItem({ providerID: provider.id, modelID: model.id }))
    .filter((item): item is ProductModelItem => !!item)
  if (query) {
    return {
      sections: [{
        id: "search",
        kind: "search",
        items: searchItems.filter((item) => `${item.provider.name ?? item.provider.id} ${item.provider.id} ${item.model.name ?? item.model.id} ${item.model.id}`.toLowerCase().includes(query)),
      }],
      searchItems,
    }
  }

  pushSection({ id: "favorites", kind: "favorites" }, input.favorites)
  pushSection({ id: "recent", kind: "recent" }, input.recents)
  pushSection({ id: "configured", kind: "configured" }, input.configured)
  if (input.current) pushSection({ id: "current", kind: "current" }, [input.current])

  const free = providers
    .filter((provider) => provider.id === "opencode")
    .flatMap((provider) => provider.models.filter((model) => model.free).map((model) => ({ providerID: provider.id, modelID: model.id, model })))
    .sort((left, right) => freeModelScore(right.model) - freeModelScore(left.model) || compareModels(left.model, right.model))
  pushSection({ id: "free", kind: "free" }, free.map((item) => ({ providerID: item.providerID, modelID: item.modelID })))

  for (const provider of providers) {
    const models = provider.models
      .filter((model) => !(provider.id === "opencode" && model.free))
      .sort(compareModels)
      .map((model) => ({ providerID: provider.id, modelID: model.id }))
    const visible = models.filter((model) => !pinned.has(modelKey(model))).slice(0, MODELS_PER_PROVIDER)
    pushSection({ id: `provider:${provider.id}`, kind: "provider", providerID: provider.id, collapsedCount: models.length }, visible)
  }

  return { sections, searchItems }
}

export function modelKey(model: ProductModelRef) {
  return `${model.providerID}/${model.modelID}`
}

export function sameModelRef(left: ProductModelRef | undefined, right: ProductModelRef | undefined) {
  return !!left && !!right && left.providerID === right.providerID && left.modelID === right.modelID
}

export function isValidModelRef(providers: ProductProvider[], model: ProductModelRef | undefined): model is ProductModelRef {
  if (!model) return false
  return providers.some((provider) => provider.id === model.providerID && provider.models.some((item) => item.id === model.modelID && item.status !== "deprecated"))
}

export function cycleModelVariant(providers: ProductProvider[], model: ProductModelRef | undefined, current?: string) {
  const variants = modelVariants(providers, model)
  if (variants.length === 0) return undefined
  const index = current ? variants.indexOf(current) : -1
  if (index < 0) return variants[0]
  return index === variants.length - 1 ? undefined : variants[index + 1]
}

export function updateProductRecentModels(recents: ProductModelRef[], model: ProductModelRef | undefined, limit = 10) {
  if (!model) return recents
  return [model, ...recents.filter((item) => !sameModelRef(item, model))]
    .slice(0, limit)
    .map((item) => ({ providerID: item.providerID, modelID: item.modelID }))
}

export function toggleProductFavoriteModel(favorites: ProductModelRef[], model: ProductModelRef) {
  if (favorites.some((item) => sameModelRef(item, model))) {
    return favorites.filter((item) => !sameModelRef(item, model))
  }
  return [{ providerID: model.providerID, modelID: model.modelID }, ...favorites]
}

export function cycleProductModelVariantState(
  providers: ProductProvider[],
  model: ProductModelRef | undefined,
  current: string | undefined,
  variants: Record<string, string>,
) {
  if (!model) return variants
  if (modelVariants(providers, model).length === 0) return variants
  return {
    ...variants,
    [modelKey(model)]: cycleModelVariant(providers, model, current) ?? "default",
  }
}

export function modelVariants(providers: ProductProvider[], model: ProductModelRef | undefined) {
  if (!model) return []
  const provider = providers.find((item) => item.id === model.providerID)
  return Object.keys(provider?.models.find((item) => item.id === model.modelID)?.variants ?? {})
}

function freeModelScore(model: ProductModel) {
  const curated = freeModelRank.get(model.id)
  if (curated !== undefined) return 10_000 + curated
  return (
    (model.status === "active" ? 1_000 : model.status === "deprecated" ? 0 : 500) +
    (model.reasoning ? 200 : 0) +
    (model.toolCall ? 100 : 0) +
    (model.inputModalities ?? []).filter((input) => input !== "text").length * 50 +
    Math.min((model.contextLimit ?? 0) / 10_000, 100) +
    releaseTime(model.releaseDate) / 1e12
  )
}

function compareModels(left: ProductModel, right: ProductModel) {
  return releaseTime(right.releaseDate) - releaseTime(left.releaseDate) || (left.name ?? left.id).localeCompare(right.name ?? right.id)
}

function releaseTime(value: string | number | undefined) {
  if (typeof value === "number") return value
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
