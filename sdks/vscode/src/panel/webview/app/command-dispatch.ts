import type { ProductCommandID, ProductTextKey } from "@opencode-ai/product"
import {
  toVsCodeCommandTarget,
  type VsCodeCommandCatalogInput,
  type VsCodeCommandTarget,
} from "../../../product/command-adapter"
import { resolveComposerSlashAction } from "./composer-actions"

// One handler per target; the Record type makes a new target without a handler a compile error.
export type VsCodeCommandHandlers = Record<VsCodeCommandTarget, () => void>

/** Single execution path for shared Product commands, used by autocomplete and Enter submit alike. */
export function runProductCommand(commandID: ProductCommandID, handlers: VsCodeCommandHandlers) {
  handlers[toVsCodeCommandTarget(commandID)]()
}

export type ComposerSubmitPlan =
  | { kind: "command"; commandID: ProductCommandID }
  | { kind: "unavailable"; commandID: string; reasonKey: ProductTextKey }
  | { kind: "send" }

/** Decides what Enter does with a draft: run a shared command, explain why it cannot run, or send it. */
export function planComposerSubmit(draft: string, catalog: VsCodeCommandCatalogInput): ComposerSubmitPlan {
  const action = resolveComposerSlashAction(draft, catalog)
  if (action?.kind === "builtin") return { kind: "command", commandID: action.commandID }
  if (action?.kind === "unavailable")
    return { kind: "unavailable", commandID: action.commandID, reasonKey: action.reasonKey ?? "command.reason.unsupported" }
  // Dynamic commands go through the host slash-command path; unknown text is sent as a prompt.
  return { kind: "send" }
}
