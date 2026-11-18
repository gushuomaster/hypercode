import {
  deriveProductCommandCatalog,
  productCommandIDs,
  resolveProductCommand,
  type ProductCommandContext,
  type ProductCommandEntry,
  type ProductCommandID,
  type ProductCommandInput,
} from "@opencode-ai/product"

const targets: Record<ProductCommandID, string> = {
  "session.new": "session.new",
  "session.list": "session.list",
  "agent.list": "agent.list",
  "model.list": "model.list",
  "variant.list": "variant.list",
  "provider.connect": "provider.connect",
  "mcp.list": "mcp.list",
  "system.status": "opencode.status",
  "session.compact": "session.compact",
  "session.undo": "session.undo",
  "session.redo": "session.redo",
  "skill.list": "prompt.skills",
  "theme.list": "theme.switch",
  "help.show": "help.show",
  "session.rename": "session.rename",
  "session.share": "session.share",
  "session.unshare": "session.unshare",
  "session.fork": "session.fork",
}

const commandIDsByTarget = new Map(Object.entries(targets).map(([id, target]) => [target, id as ProductCommandID]))

type TuiCommandFacts = {
  registered: string[]
  reachable: string[]
}

export type TuiProductCommandProjection = {
  context: ProductCommandContext
  catalog: ProductCommandEntry[]
}

export type TuiSlashCommandFact = {
  name: string
  title?: string
  description?: string
  slashName?: string
  slashAliases?: string[]
}

export type TuiSlashCommandEntry = {
  id: string
  display: string
  description?: string
  aliases?: string[]
  target: string
}

export type TuiSlashCommandProjection = {
  context: ProductCommandContext
  entries: TuiSlashCommandEntry[]
}

export type TuiPaletteCommandEntry = {
  id: string
  target: string
  scope: "shared" | "shared_surface_optional" | "host_only"
}

export function toTuiProductCommands(inputs: ProductCommandInput[]): ProductCommandEntry[]
export function toTuiProductCommands(input: TuiCommandFacts): TuiProductCommandProjection
export function toTuiProductCommands(input: ProductCommandInput[] | TuiCommandFacts): ProductCommandEntry[] | TuiProductCommandProjection {
  if (Array.isArray(input)) return deriveProductCommandCatalog(input)

  const registered = new Set(input.registered)
  const reachable = new Set(input.reachable)
  const context: ProductCommandContext = {
    supported: Object.fromEntries(productCommandIDs.map((id) => [id, true])),
    hasSession: registered.has(targets["session.compact"]),
    canUndo: reachable.has(targets["session.undo"]),
    canRedo: reachable.has(targets["session.redo"]),
    hasVariants: reachable.has(targets["variant.list"]),
    hasConnectableProvider: reachable.has(targets["provider.connect"]),
  }
  return {
    context,
    catalog: deriveProductCommandCatalog({ context }),
  }
}

export function toTuiDynamicProductCommands(context: ProductCommandContext, inputs: ProductCommandInput[]): ProductCommandEntry[] {
  const builtinIDs = new Set<string>(productCommandIDs)
  return deriveProductCommandCatalog({ context, dynamic: inputs }).filter((entry) => !builtinIDs.has(entry.id))
}

export function resolveTuiProductCommand(input: {
  value: string
  context: ProductCommandContext
  dynamic: ProductCommandInput[]
}) {
  const result = resolveProductCommand({
    value: input.value,
    catalog: deriveProductCommandCatalog({ context: input.context, dynamic: input.dynamic }),
  })
  if (result?.kind !== "builtin") return result
  return {
    ...result,
    target: targets[result.commandID],
  }
}

export function toTuiSlashCommands(input: {
  registered: TuiSlashCommandFact[]
  reachable: string[]
}): TuiSlashCommandProjection {
  const projection = toTuiProductCommands({
    registered: input.registered.map((command) => command.name),
    reachable: input.reachable,
  })
  const registered = new Map(input.registered.map((command) => [command.name, command]))
  const reachable = new Set(input.reachable)
  const shared = projection.catalog.flatMap((entry): TuiSlashCommandEntry[] => {
    if ((entry.scope !== "shared" && entry.scope !== "shared_surface_optional") || entry.availability !== "available") return []
    const target = targets[entry.id as ProductCommandID]
    const command = registered.get(target)
    if (!command) return []
    return [{
      id: entry.id,
      display: `/${entry.name}`,
      description: command.description ?? command.title,
      aliases: entry.aliases.map((alias) => `/${alias}`),
      target,
    }]
  })
  const host = input.registered.flatMap((command): TuiSlashCommandEntry[] => {
    if (commandIDsByTarget.has(command.name) || !command.slashName || !reachable.has(command.name)) return []
    return [{
      id: `host:${command.name}`,
      display: `/${command.slashName}`,
      description: command.description ?? command.title,
      aliases: command.slashAliases?.map((alias) => `/${alias}`),
      target: command.name,
    }]
  })
  return {
    context: projection.context,
    entries: [...shared, ...host].sort((left, right) => left.display.localeCompare(right.display)),
  }
}

export function toTuiPaletteCommands(input: TuiCommandFacts): TuiPaletteCommandEntry[] {
  const projection = toTuiProductCommands(input)
  const registered = new Set(input.registered)
  const reachable = new Set(input.reachable)
  const shared = projection.catalog.flatMap((entry): TuiPaletteCommandEntry[] => {
    if ((entry.scope !== "shared" && entry.scope !== "shared_surface_optional") || entry.availability !== "available") return []
    const target = targets[entry.id as ProductCommandID]
    if (!registered.has(target) || !reachable.has(target)) return []
    return [{ id: entry.id, target, scope: entry.scope }]
  })
  const host = input.reachable
    .filter((target) => registered.has(target) && !commandIDsByTarget.has(target))
    .sort((left, right) => left.localeCompare(right))
    .map((target): TuiPaletteCommandEntry => ({
      id: `host:${target}`,
      target,
      scope: "host_only",
    }))
  return [...shared, ...host]
}

export function toTuiCommandTarget(id: ProductCommandID) {
  return targets[id]
}
