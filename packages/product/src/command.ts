import type { ProductTextKey } from "./text"

export type ProductCommandAvailability = "available" | "unavailable" | "unsupported"
export type ProductCommandScope = "shared" | "shared_surface_optional" | "host_only"

export const productCommandIDs = [
  "session.new",
  "session.list",
  "agent.list",
  "model.list",
  "variant.list",
  "provider.connect",
  "mcp.list",
  "system.status",
  "session.compact",
  "session.undo",
  "session.redo",
  "skill.list",
  "theme.list",
  "help.show",
  "session.rename",
  "session.share",
  "session.unshare",
  "session.fork",
] as const

export type ProductCommandID = typeof productCommandIDs[number]

export type ProductCommandContext = {
  supported: Partial<Record<ProductCommandID, boolean>>
  hasSession?: boolean
  canUndo?: boolean
  canRedo?: boolean
  hasVariants?: boolean
  hasConnectableProvider?: boolean
  isShared?: boolean
}

// Host 只上报会话原始数据，命令可用性事实的语义统一由 Product 推导。
export type ProductCommandSessionFacts = {
  hasSession: boolean
  messages: { id: string; role: string }[]
  revertMessageID?: string
  shareURL?: string
}

// canUndo：撤销点之前仍存在 user 消息；canRedo：存在撤销点；isShared：存在分享链接。
export function deriveProductCommandSessionContext(facts: ProductCommandSessionFacts) {
  const revertIndex = facts.revertMessageID ? facts.messages.findIndex((message) => message.id === facts.revertMessageID) : -1
  const visible = revertIndex === -1 ? facts.messages : facts.messages.slice(0, revertIndex)
  return {
    hasSession: facts.hasSession,
    canUndo: facts.hasSession && visible.some((message) => message.role === "user"),
    canRedo: facts.hasSession && !!facts.revertMessageID,
    isShared: facts.hasSession && !!facts.shareURL,
  }
}

export type ProductCommandInput = {
  id: string
  name: string
  title?: string
  description?: string
  category?: string
  source?: string
  hidden?: boolean
  enabled?: boolean
}

export type ProductCommandCatalogInput = {
  context: ProductCommandContext
  dynamic?: ProductCommandInput[]
}

export type ProductCommandEntry = {
  id: string
  name: string
  aliases: string[]
  title: string
  textKey?: ProductTextKey
  description?: string
  category?: string
  source?: string
  scope: ProductCommandScope
  availability: ProductCommandAvailability
  reasonKey?: ProductTextKey
}

export type ProductCommandResolution =
  | { kind: "builtin"; commandID: ProductCommandID; arguments: string }
  | { kind: "dynamic"; name: string; arguments: string; source?: string }
  | {
      kind: "unavailable"
      commandID: string
      availability: Exclude<ProductCommandAvailability, "available">
      reasonKey?: ProductTextKey
    }

type ProductCommandDefinition = {
  id: ProductCommandID
  name: string
  aliases?: string[]
  textKey: ProductTextKey
  scope?: Exclude<ProductCommandScope, "host_only">
}

const builtinCommands: ProductCommandDefinition[] = [
  { id: "session.new", name: "new", aliases: ["clear"], textKey: "command.session.new" },
  { id: "session.list", name: "sessions", aliases: ["resume", "continue"], textKey: "command.session.list" },
  { id: "agent.list", name: "agents", textKey: "command.agent.list" },
  { id: "model.list", name: "models", aliases: ["model", "mo"], textKey: "command.model.list" },
  { id: "variant.list", name: "variants", textKey: "command.variant.list" },
  { id: "provider.connect", name: "connect", textKey: "command.provider.connect" },
  { id: "mcp.list", name: "mcps", aliases: ["mcp"], textKey: "command.mcp.list" },
  { id: "system.status", name: "status", textKey: "command.system.status" },
  { id: "session.compact", name: "compact", textKey: "command.session.compact" },
  { id: "session.undo", name: "undo", textKey: "command.session.undo" },
  { id: "session.redo", name: "redo", textKey: "command.session.redo" },
  { id: "skill.list", name: "skills", textKey: "command.skill.list" },
  { id: "theme.list", name: "themes", aliases: ["theme"], textKey: "command.theme.list" },
  { id: "help.show", name: "help", textKey: "command.help.show" },
  { id: "session.rename", name: "rename", textKey: "command.session.rename", scope: "shared_surface_optional" },
  { id: "session.share", name: "share", textKey: "command.session.share", scope: "shared_surface_optional" },
  { id: "session.unshare", name: "unshare", textKey: "command.session.unshare", scope: "shared_surface_optional" },
  { id: "session.fork", name: "fork", textKey: "command.session.fork", scope: "shared_surface_optional" },
]

export function deriveProductCommandCatalog(input: ProductCommandCatalogInput): ProductCommandEntry[]
export function deriveProductCommandCatalog(input: ProductCommandInput[]): ProductCommandEntry[]
export function deriveProductCommandCatalog(input: ProductCommandCatalogInput | ProductCommandInput[]): ProductCommandEntry[] {
  if (Array.isArray(input)) return deriveDynamicProductCommands(input)

  const builtins = builtinCommands.map((definition): ProductCommandEntry => {
    const availability = commandAvailability(definition.id, input.context)
    return {
      id: definition.id,
      name: definition.name,
      aliases: definition.aliases ?? [],
      title: definition.name,
      textKey: definition.textKey,
      scope: definition.scope ?? "shared",
      availability: availability.availability,
      ...(availability.reasonKey ? { reasonKey: availability.reasonKey } : {}),
    }
  })
  const reserved = new Set(builtins.flatMap((entry) => [entry.name, ...entry.aliases]))
  const dynamic = deriveDynamicProductCommands(input.dynamic ?? []).filter((entry) => !reserved.has(entry.name))
  return [...builtins, ...dynamic].sort(compareCommands)
}

export function resolveProductCommand(input: {
  value: string
  catalog: ProductCommandEntry[]
}): ProductCommandResolution | undefined {
  const match = input.value.trim().match(/^\/(\S+)(?:\s+([\s\S]*))?$/)
  if (!match) return
  const name = match[1] ?? ""
  const entry = input.catalog.find((candidate) => candidate.name === name || candidate.aliases.includes(name))
  if (!entry) return
  if (entry.availability !== "available") {
    return {
      kind: "unavailable",
      commandID: entry.id,
      availability: entry.availability,
      ...(entry.reasonKey ? { reasonKey: entry.reasonKey } : {}),
    }
  }
  const argumentsValue = (match[2] ?? "").trim()
  if (isProductCommandID(entry.id)) {
    return { kind: "builtin", commandID: entry.id, arguments: argumentsValue }
  }
  return {
    kind: "dynamic",
    name: entry.name,
    arguments: argumentsValue,
    ...(entry.source ? { source: entry.source } : {}),
  }
}

function deriveDynamicProductCommands(inputs: ProductCommandInput[]): ProductCommandEntry[] {
  const entries = new Map<string, ProductCommandEntry>()
  const names = new Set<string>()
  for (const input of inputs) {
    const id = input.id.trim()
    const name = input.name.trim()
    if (!id || !name || input.hidden || entries.has(id) || names.has(name)) continue
    names.add(name)
    entries.set(id, {
      id,
      name,
      aliases: [],
      title: input.title?.trim() || name,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.category?.trim() ? { category: input.category.trim() } : {}),
      ...(input.source?.trim() ? { source: input.source.trim() } : {}),
      scope: "shared_surface_optional",
      availability: input.enabled === false ? "unsupported" : "available",
      ...(input.enabled === false ? { reasonKey: "command.reason.unsupported" as const } : {}),
    })
  }
  return [...entries.values()].sort(compareCommands)
}

const sessionScopedCommands = new Set<ProductCommandID>([
  "session.compact",
  "session.undo",
  "session.redo",
  "session.rename",
  "session.share",
  "session.unshare",
  "session.fork",
])

function commandAvailability(id: ProductCommandID, context: ProductCommandContext): {
  availability: ProductCommandAvailability
  reasonKey?: ProductTextKey
} {
  if (context.supported[id] !== true) {
    return { availability: "unsupported", reasonKey: "command.reason.unsupported" }
  }
  if (id === "variant.list" && !context.hasVariants) {
    return { availability: "unavailable", reasonKey: "command.reason.no_variants" }
  }
  if (id === "provider.connect" && !context.hasConnectableProvider) {
    return { availability: "unavailable", reasonKey: "command.reason.no_provider" }
  }
  if (sessionScopedCommands.has(id) && !context.hasSession) {
    return { availability: "unavailable", reasonKey: "command.reason.session_required" }
  }
  if (id === "session.unshare" && !context.isShared) {
    return { availability: "unavailable", reasonKey: "command.reason.not_shared" }
  }
  if (id === "session.undo" && !context.canUndo) {
    return { availability: "unavailable", reasonKey: "command.reason.undo_unavailable" }
  }
  if (id === "session.redo" && !context.canRedo) {
    return { availability: "unavailable", reasonKey: "command.reason.redo_unavailable" }
  }
  return { availability: "available" }
}

function isProductCommandID(id: string): id is ProductCommandID {
  return productCommandIDs.includes(id as ProductCommandID)
}

function compareCommands(left: ProductCommandEntry, right: ProductCommandEntry) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}
