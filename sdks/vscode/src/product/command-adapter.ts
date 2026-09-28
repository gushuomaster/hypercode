import {
  deriveProductCommandCatalog,
  productCommandIDs,
  resolveProductCommand,
  type ProductCommandContext,
  type ProductCommandEntry,
  type ProductCommandID,
  type ProductCommandInput,
} from "@opencode-ai/product"

export type VsCodeCommandCatalogInput = ProductCommandContext & {
  dynamic?: ProductCommandInput[]
}

export type VsCodeProductCommandProjection = {
  context: ProductCommandContext
  catalog: ProductCommandEntry[]
}

export type VsCodeCommandTarget =
  | "newSession"
  | "openSessionPicker"
  | "openAgentPicker"
  | "openModelPicker"
  | "openMcpStatus"
  | "openSystemStatus"
  | "compactSession"
  | "undoSession"
  | "redoSession"
  | "openSkillPicker"
  | "openThemePicker"
  | "openCommandHelp"

const targets: Record<ProductCommandID, VsCodeCommandTarget> = {
  "session.new": "newSession",
  "session.list": "openSessionPicker",
  "agent.list": "openAgentPicker",
  "model.list": "openModelPicker",
  "variant.list": "openModelPicker",
  "provider.connect": "openModelPicker",
  "mcp.list": "openMcpStatus",
  "system.status": "openSystemStatus",
  "session.compact": "compactSession",
  "session.undo": "undoSession",
  "session.redo": "redoSession",
  "skill.list": "openSkillPicker",
  "theme.list": "openThemePicker",
  "help.show": "openCommandHelp",
}

export function toVsCodeProductCommands(inputs: ProductCommandInput[]): ProductCommandEntry[]
export function toVsCodeProductCommands(input: VsCodeCommandCatalogInput): VsCodeProductCommandProjection
export function toVsCodeProductCommands(input: ProductCommandInput[] | VsCodeCommandCatalogInput): ProductCommandEntry[] | VsCodeProductCommandProjection {
  if (Array.isArray(input)) return deriveProductCommandCatalog(input)
  const { dynamic, supported, ...inputContext } = input
  const context: ProductCommandContext = {
    supported: Object.fromEntries(productCommandIDs.map((id) => [id, supported?.[id] !== false])),
    ...inputContext,
  }
  return {
    context,
    catalog: deriveProductCommandCatalog({ context, dynamic }),
  }
}

export function resolveVsCodeProductCommand(value: string, input: VsCodeCommandCatalogInput) {
  const projection = toVsCodeProductCommands(input)
  return resolveProductCommand({
    value,
    catalog: projection.catalog,
  })
}

export function toVsCodeCommandTarget(id: ProductCommandID): VsCodeCommandTarget {
  return targets[id]
}
