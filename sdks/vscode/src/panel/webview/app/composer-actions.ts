import type { CommandInfo } from "../../../core/sdk"

type ComposerSlashActionOptions = {
  showSkillsInSlashAutocomplete?: boolean
}

export type ComposerSlashAction =
  | {
      type: "newSession"
    }
  | {
      type: "openSessionPicker"
    }
  | {
      type: "openSkillPicker"
    }
  | {
      type: "openThemePicker"
    }
  | {
      type: "command"
      command: string
      arguments: string
    }

export type ComposerAutocompleteAction =
  | {
      type: "newSessionInPlace"
    }
  | {
      type: "openSkillPicker"
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

  switch (item.id) {
    case "slash-new":
      return { type: "newSessionInPlace" }
    case "slash-skills":
      return { type: "openSkillPicker" }
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
    case "slash-reset-agent":
      return { type: "resetAgent" }
    case "slash-refresh":
      return { type: "refreshSession" }
    case "slash-sessions":
      return { type: "openSessionPicker" }
    default:
      return undefined
  }
}

export function resolveComposerSlashAction(
  draft: string,
  commands: CommandInfo[],
  options?: ComposerSlashActionOptions,
): ComposerSlashAction | undefined {
  const slashMatch = draft.trim().match(/^\/(\S+)(?:\s+([\s\S]*))?$/)
  if (!slashMatch) {
    return undefined
  }

  const command = slashMatch[1] ?? ""
  const args = (slashMatch[2] ?? "").trim()

  if (command === "new" && !args) {
    return { type: "newSession" }
  }

  if (command === "sessions" && !args) {
    return { type: "openSessionPicker" }
  }

  if (command === "skills" && !args) {
    return { type: "openSkillPicker" }
  }

  if (command === "theme" && !args) {
    return { type: "openThemePicker" }
  }

  const known = commands.find((item) => item.name === command)
  if (!known) {
    return undefined
  }

  return {
    type: "command",
    command,
    arguments: args,
  }
}

export function isCompletedSlashCommand(draft: string, commands: CommandInfo[]) {
  const slashMatch = draft.match(/^\/(\S+)\s+$/) ?? draft.trim().match(/^\/(\S+)$/)
  if (!slashMatch) {
    return false
  }

  const command = slashMatch[1] ?? ""
  return commands.some((item) => item.name === command)
}
