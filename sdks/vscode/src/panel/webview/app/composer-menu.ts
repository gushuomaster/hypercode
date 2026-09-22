import type { ComposerPathResult } from "../../../bridge/types"
import type { AppState } from "./state"
import type { ComposerAutocompleteItem } from "../hooks/useComposerAutocomplete"
import { formatComposerFileContent, formatComposerFileDisplay, parseComposerFileQuery } from "../lib/composer-file-selection"
import { localizedCommandDescription, t } from "../../../i18n"

type ComposerMenuState = {
  composerAgentOverride?: AppState["composerAgentOverride"]
  composerMentionAgentOverride?: AppState["composerMentionAgentOverride"]
  snapshot: Pick<AppState["snapshot"], "display" | "session" | "commands" | "agents" | "mcpResources" | "skillCatalog">
}

export function buildComposerMenuItems(state: ComposerMenuState, files: ComposerPathResult[]): ComposerAutocompleteItem[] {
  const slashItems: ComposerAutocompleteItem[] = [
    {
      id: "slash-agents",
      label: "agents",
      detail: t("slash.agents"),
      keywords: ["agent", "primary", "subagent"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-new",
      label: "new",
      detail: t("slash.new"),
      keywords: ["session", "fresh", "conversation"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-compact",
      label: "compact",
      detail: t("slash.compact"),
      keywords: ["summarize", "summary", "compress", "session"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-model",
      label: "model",
      detail: t("slash.model"),
      keywords: ["switch", "provider", "variant", "llm"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-theme",
      label: "theme",
      detail: t("slash.theme"),
      keywords: ["switch", "appearance", "panel", "claude", "codex"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-sessions",
      label: "sessions",
      detail: t("slash.sessions"),
      keywords: ["switch", "session", "related", "workspace", "tags"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-undo",
      label: "undo",
      detail: t("slash.undo"),
      keywords: ["revert", "previous", "message", "back"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-refresh",
      label: "refresh",
      detail: t("slash.refresh"),
      keywords: ["reload", "snapshot", "panel", "host"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-skills",
      label: "skills",
      detail: t("slash.skills"),
      keywords: ["skill", "picker", "workflow"],
      trigger: "slash",
      kind: "action",
    },
  ]

  if (state.snapshot.session?.revert?.messageID) {
    slashItems.push({
      id: "slash-redo",
      label: "redo",
      detail: t("slash.redo"),
      keywords: ["unrevert", "restore", "forward"],
      trigger: "slash",
      kind: "action",
    })
  }

  if (state.composerAgentOverride || state.composerMentionAgentOverride) {
    slashItems.push({
      id: "slash-reset-agent",
      label: "reset-agent",
      detail: t("slash.resetAgent"),
      keywords: ["agent", "default", "override"],
      trigger: "slash",
      kind: "action",
    })
  }

  const commandItems: ComposerAutocompleteItem[] = state.snapshot.commands
    .filter((cmd) => cmd.source !== "skill")
    .map((cmd) => ({
      id: `command:${cmd.name}`,
      label: cmd.name,
      detail: commandDescription(cmd, cmd.source === "mcp"),
      keywords: [cmd.source ?? "", cmd.agent ?? "", localizedCommandDescription(cmd) ?? ""].filter(Boolean),
      trigger: "slash" as const,
      kind: "command" as const,
    }))

  const skillCommands = state.snapshot.commands.filter((cmd) => cmd.source === "skill")
  const fallbackSkills = state.snapshot.skillCatalog.filter(
    (skill) => !skillCommands.some((cmd) => cmd.name === skill.name),
  )
  const skillItems: ComposerAutocompleteItem[] = [...skillCommands, ...fallbackSkills]
    .map((item) => ("hints" in item
      ? {
          id: `skill:${item.name}`,
          label: item.name,
          detail: commandDescription(item, false),
          keywords: [item.agent ?? "", ...item.hints].filter(Boolean),
          trigger: "skill" as const,
          kind: "SKILL" as const,
        }
      : {
          id: `skill:${item.name}`,
          label: item.name,
          detail: item.content.trim().split(/\r?\n/)[0] ?? "",
          keywords: [],
          trigger: "skill" as const,
          kind: "SKILL" as const,
        }))

  const agentItems = state.snapshot.agents
    .filter((agent) => !agent.hidden && agent.mode !== "primary")
    .map((agent) => ({
      id: `agent:${agent.name}`,
      label: `@${agent.name}`,
      detail: "",
      keywords: [agent.mode, agent.variant ?? ""].filter(Boolean),
      value: `@${agent.name}`,
      trigger: "mention" as const,
      kind: "agent" as const,
      mention: {
        type: "agent" as const,
        name: agent.name,
        content: `@${agent.name}`,
      },
    }))

  const resourceItems = Object.values(state.snapshot.mcpResources).map((resource) => ({
    id: `resource:${resource.client}:${resource.uri}`,
    label: `@${resource.name}`,
    detail: `${resource.name} (${resource.uri})`,
    keywords: [resource.client, resource.uri, resource.description ?? ""].filter(Boolean),
    value: `${resource.name} (${resource.uri})`,
    trigger: "mention" as const,
    kind: "resource" as const,
    mention: {
      type: "resource" as const,
      uri: resource.uri,
      name: resource.name,
      clientName: resource.client,
      mimeType: resource.mimeType,
      content: `@${resource.name}`,
    },
  }))

  const fileItems = files.map((item) => ({
    id: `${item.source}:${item.kind}:${item.path}:${item.selection?.startLine ?? ""}:${item.selection?.endLine ?? ""}`,
    label: `@${item.path}`,
    detail: item.path,
    keywords: item.path
      .split("/")
      .filter(Boolean)
      .concat(item.source, item.kind, item.selection ? [String(item.selection.startLine), String(item.selection.endLine ?? "")] : []),
    value: item.path,
    trigger: "mention" as const,
    kind:
      item.source === "selection"
        ? "selection" as const
        : item.source === "recent"
          ? "recent" as const
          : item.kind === "directory"
            ? "directory" as const
            : "file" as const,
    mention: {
      type: "file" as const,
      path: item.path,
      kind: item.kind,
      selection: item.selection,
      content: formatComposerFileContent(item.path, item.selection),
    },
  }))

  return [...slashItems, ...commandItems, ...skillItems, ...agentItems, ...fileItems, ...resourceItems]
}

export function mentionForQuery(
  mention: Extract<NonNullable<ComposerAutocompleteItem["mention"]>, { type: "file" }>,
  query: string,
): Extract<NonNullable<ComposerAutocompleteItem["mention"]>, { type: "file" }> {
  const parsed = parseComposerFileQuery(query)
  if (!parsed.selection || mention.kind === "directory" || mention.selection) {
    return mention
  }

  return {
    ...mention,
    selection: parsed.selection,
    content: formatComposerFileContent(mention.path, parsed.selection),
  }
}

export function autocompleteItemView(query: string, item: ComposerAutocompleteItem) {
  const mention = item.mention
  if (!mention || mention.type === "agent" || mention.type === "resource") {
    return autocompleteItemDisplay(item.label, item.detail, item.kind)
  }

  const next = mentionForQuery(mention, query)
  return autocompleteItemDisplay(
    next.selection ? formatComposerFileDisplay(item.label, next.selection) : item.label,
    next.selection ? formatComposerFileDisplay(item.detail, next.selection) : item.detail,
    item.kind,
  )
}

function autocompleteItemDisplay(label: string, detail: string, kind: ComposerAutocompleteItem["kind"]) {
  const normalizedDetail = normalizeAutocompleteDetail(detail)
  return {
    label,
    detail: normalizedDetail,
    fullDetail: normalizedDetail,
    kind: localizeAutocompleteKind(kind),
  }
}

function normalizeAutocompleteDetail(detail: string) {
  return detail.replace(/\s+/g, " ").trim()
}

function localizeAutocompleteKind(kind: ComposerAutocompleteItem["kind"]) {
  return kind
}

function commandDescription(command: Pick<AppState["snapshot"]["commands"][number], "description" | "description_i18n">, isMcp: boolean) {
  const localized = localizedCommandDescription(command) ?? ""
  if (isMcp) {
    return localized ? `${localized} :mcp` : ":mcp"
  }

  return localized
}
