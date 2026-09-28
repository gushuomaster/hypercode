import type { ComposerPathResult } from "../../../bridge/types"
import type { AppState } from "./state"
import type { ComposerAutocompleteItem } from "../hooks/useComposerAutocomplete"
import { formatComposerFileContent, formatComposerFileDisplay, parseComposerFileQuery } from "../lib/composer-file-selection"
import { localizedCommandDescription, t } from "../../../i18n"
import { toVsCodeProductCommands } from "../../../product/command-adapter"
import type { VsCodeCommandCatalogInput } from "../../../product/command-adapter"
import { mergeProductSkillCatalog } from "@opencode-ai/product"
import { toVsCodeTextKey } from "../lib/product-text-adapter"

type ComposerMenuState = {
  composerAgentOverride?: AppState["composerAgentOverride"]
  composerMentionAgentOverride?: AppState["composerMentionAgentOverride"]
  snapshot: Pick<AppState["snapshot"], "display" | "session" | "commands" | "agents" | "mcpResources" | "skillCatalog" | "providers" | "providerStates" | "messages" | "mcpStates" | "lspStates" | "formatterStates">
}

export function buildComposerCommandCatalogInput(snapshot: ComposerMenuState["snapshot"]): VsCodeCommandCatalogInput {
  return {
    supported: {},
    hasSession: !!snapshot.session,
    canUndo: snapshot.messages.some((message) => message.info.role === "user"),
    canRedo: !!snapshot.session?.revert?.messageID,
    hasVariants: snapshot.providers.some((provider) => Object.values(provider.models ?? {}).some((model) => Object.keys(model.variants ?? {}).length > 0)),
    hasConnectableProvider: snapshot.providers.length > 0,
    dynamic: snapshot.commands
      .filter((command) => command.source !== "skill")
      .map((command) => ({
        id: `command:${command.name}`,
        name: command.name,
        title: command.name,
        description: localizedCommandDescription(command),
        source: command.source,
      })),
  }
}

export function buildComposerMenuItems(state: ComposerMenuState, files: ComposerPathResult[]): ComposerAutocompleteItem[] {
  const projection = toVsCodeProductCommands(buildComposerCommandCatalogInput(state.snapshot))

  const slashItems: ComposerAutocompleteItem[] = projection.catalog
    .filter((entry) => entry.scope === "shared" && entry.availability === "available")
    .map((entry) => ({
      id: `product:${entry.id}`,
      label: entry.name,
      detail: entry.textKey ? t(toVsCodeTextKey(entry.textKey)) : entry.title,
      keywords: [entry.name, ...entry.aliases, entry.category ?? ""].filter(Boolean),
      trigger: "slash" as const,
      kind: "action" as const,
    }))

  slashItems.push({
    id: "host:refresh",
    label: "refresh",
    detail: t("slash.refresh"),
    keywords: ["reload", "snapshot", "panel", "host"],
    trigger: "slash",
    kind: "action",
  })

  if (state.composerAgentOverride || state.composerMentionAgentOverride) {
    slashItems.push({
      id: "host:reset-agent",
      label: "reset-agent",
      detail: t("slash.resetAgent"),
      keywords: ["agent", "default", "override"],
      trigger: "slash",
      kind: "action",
    })
  }

  const commands = state.snapshot.commands.filter((cmd) => cmd.source !== "skill")
  const commandsByName = new Map(commands.map((command) => [command.name, command]))
  const commandItems: ComposerAutocompleteItem[] = projection.catalog.filter((entry) => entry.scope !== "shared").flatMap((entry) => {
    const cmd = commandsByName.get(entry.name)
    if (!cmd) return []
    return [{
      id: `command:${cmd.name}`,
      label: cmd.name,
      detail: commandDescription(cmd, cmd.source === "mcp"),
      keywords: [cmd.source ?? "", cmd.agent ?? "", localizedCommandDescription(cmd) ?? ""].filter(Boolean),
      trigger: "slash" as const,
      kind: "command" as const,
    }]
  })

  const skillCommands = state.snapshot.commands.filter((cmd) => cmd.source === "skill")
  const skillCommandsByName = new Map(skillCommands.map((command) => [command.name, command]))
  const skillCatalogByName = new Map(state.snapshot.skillCatalog.map((skill) => [skill.name, skill]))
  const productSkills = mergeProductSkillCatalog(
    { items: state.snapshot.skillCatalog },
    skillCommands.map((command) => ({ name: command.name, description: localizedCommandDescription(command) })),
  )
  const skillItems: ComposerAutocompleteItem[] = productSkills.items.flatMap((item) => {
    const command = skillCommandsByName.get(item.name)
    const catalog = skillCatalogByName.get(item.name)
    if (!command && !catalog) return []
    const category = t(toVsCodeTextKey(item.textKey))
    if (command) return [{
      id: `skill:${command.name}`,
      label: command.name,
      detail: commandDescription(command, false),
      category,
      keywords: [command.agent ?? "", ...command.hints].filter(Boolean),
      trigger: "skill" as const,
      kind: "SKILL" as const,
    }]
    if (!catalog) return []
    return [{
      id: `skill:${catalog.name}`,
      label: catalog.name,
      detail: catalog.content.trim().split(/\r?\n/)[0] ?? "",
      category,
      keywords: [],
      trigger: "skill" as const,
      kind: "SKILL" as const,
    }]
  })

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
