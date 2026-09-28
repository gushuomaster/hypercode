import type { ComposerPromptPart, WebviewMessage } from "../../../bridge/types"
import type { MessageInfo } from "../../../core/sdk"
import type { VsCodeCommandCatalogInput } from "../../../product/command-adapter"
import { resolveComposerSlashAction } from "./composer-actions"

type ComposerImageInput = NonNullable<Extract<WebviewMessage, { type: "submit" }>["images"]>

type ComposerHostMessage = Extract<WebviewMessage, { type: "submit" | "runSlashCommand" }>

type BuildComposerHostMessageInput = {
  draft: string
  commandCatalog?: VsCodeCommandCatalogInput
  commands?: Array<{ name: string; description?: string; source?: string }>
  parts: ComposerPromptPart[]
  images: ComposerImageInput
  agent?: string
  model?: MessageInfo["model"]
  variant?: string
}

export function buildComposerHostMessage(input: BuildComposerHostMessageInput): ComposerHostMessage {
  const commandCatalog = input.commandCatalog ?? {
    supported: {},
    hasSession: true,
    canUndo: true,
    canRedo: true,
    hasVariants: true,
    hasConnectableProvider: true,
    dynamic: (input.commands ?? []).map((command) => ({
      id: `command:${command.name}`,
      name: command.name,
      description: command.description,
      source: command.source,
    })),
  } satisfies VsCodeCommandCatalogInput
  const slashAction = resolveComposerSlashAction(input.draft, commandCatalog)
  const commandParts = input.images.map((attachment) => ({
    type: "file" as const,
    mime: attachment.mime,
    url: attachment.dataUrl,
    filename: attachment.name,
  }))

  if (slashAction?.kind === "dynamic") {
    return {
      type: "runSlashCommand",
      command: slashAction.name,
      arguments: slashAction.arguments,
      ...(commandParts.length > 0 ? { parts: commandParts } : {}),
      agent: input.agent,
      model: input.model ? `${input.model.providerID}/${input.model.modelID}` : undefined,
      variant: input.variant,
    }
  }

  return {
    type: "submit",
    text: input.draft,
    parts: input.parts,
    images: input.images.length > 0 ? input.images : undefined,
    agent: input.agent,
    model: input.model,
    variant: input.variant,
  }
}
