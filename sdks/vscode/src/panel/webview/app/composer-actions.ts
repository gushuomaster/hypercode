import { productCommandIDs, type ProductCommandID } from "@opencode-ai/product"
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

export type ComposerAutocompleteAction =
  | {
      type: "builtin"
      commandID: ProductCommandID
    }
  | {
      type: "newSessionInPlace"
    }
  | {
      type: "openSkillPicker"
    }
  | {
      type: "openAgentPicker"
    }
  | {
      type: "undoSession"
    }
  | {
      type: "redoSession"
    }
  | {
      type: "compactSession"
    }
  | {
      type: "openModelPicker"
    }
  | {
      type: "openThemePicker"
    }
  | {
      type: "resetAgent"
    }
  | {
      type: "refreshSession"
    }
  | {
      type: "openSessionPicker"
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
    case "slash-new":
      return { type: "newSessionInPlace" }
    case "slash-skills":
      return { type: "openSkillPicker" }
    case "slash-agents":
      return { type: "openAgentPicker" }
    case "slash-undo":
      return { type: "undoSession" }
    case "slash-redo":
      return { type: "redoSession" }
    case "slash-compact":
      return { type: "compactSession" }
    case "slash-model":
      return { type: "openModelPicker" }
    case "slash-theme":
      return { type: "openThemePicker" }
    case "host:reset-agent":
      return { type: "resetAgent" }
    case "host:refresh":
      return { type: "refreshSession" }
    case "slash-sessions":
      return { type: "openSessionPicker" }
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
  if (resolved.kind === "builtin") return resolved
  if (resolved.kind === "dynamic") return resolved
  return undefined
}

export function isCompletedSlashCommand(draft: string, catalog: VsCodeCommandCatalogInput) {
  const slashMatch = draft.match(/^\/(\S+)\s+$/) ?? draft.trim().match(/^\/(\S+)$/)
  if (!slashMatch) {
    return false
  }
  return resolveVsCodeProductCommand(draft, catalog)?.kind === "dynamic"
}
