import { productCommandIDs, type ProductCommandAvailability, type ProductCommandID, type ProductTextKey } from "@opencode-ai/product"
import type { VsCodeCommandCatalogInput } from "../../../product/command-adapter"
import { resolveVsCodeProductCommand } from "../../../product/command-adapter"

export type ComposerSlashAction =
  | {
      kind: "builtin"
      commandID: ProductCommandID
      arguments: string
    }
  | {
      kind: "dynamic"
      name: string
      source?: string
      arguments: string
    }
  | {
      kind: "unavailable"
      commandID: string
      availability: Exclude<ProductCommandAvailability, "available">
      reasonKey?: ProductTextKey
    }

export type ComposerAutocompleteAction =
  | {
      type: "builtin"
      commandID: ProductCommandID
    }
  | {
      type: "resetAgent"
    }
  | {
      type: "refreshSession"
    }

export function resolveComposerAutocompleteAction(item: { id: string; kind: string }): ComposerAutocompleteAction | undefined {
  if (item.kind !== "action") {
    return undefined
  }

  if (item.id.startsWith("product:")) {
    const commandID = item.id.slice("product:".length)
    if (productCommandIDs.includes(commandID as ProductCommandID)) {
      return { type: "builtin", commandID: commandID as ProductCommandID }
    }
  }

  switch (item.id) {
    case "host:reset-agent":
      return { type: "resetAgent" }
    case "host:refresh":
      return { type: "refreshSession" }
    default:
      return undefined
  }
}

export function resolveComposerSlashAction(
  draft: string,
  catalog: VsCodeCommandCatalogInput,
): ComposerSlashAction | undefined {
  const resolved = resolveVsCodeProductCommand(draft, catalog)
  if (!resolved) return undefined
  return resolved
}

export function isCompletedSlashCommand(draft: string, catalog: VsCodeCommandCatalogInput) {
  const slashMatch = draft.match(/^\/(\S+)\s+$/) ?? draft.trim().match(/^\/(\S+)$/)
  if (!slashMatch) {
    return false
  }
  return resolveVsCodeProductCommand(draft, catalog)?.kind === "dynamic"
}
