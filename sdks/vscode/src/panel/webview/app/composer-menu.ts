import type { ComposerPathResult } from "../../../bridge/types"
import type { AppState } from "./state"
import type { ComposerAutocompleteItem } from "../hooks/useComposerAutocomplete"
import { formatComposerFileContent, formatComposerFileDisplay, parseComposerFileQuery } from "../lib/composer-file-selection"

type ComposerMenuState = {
  composerAgentOverride?: AppState["composerAgentOverride"]
  composerMentionAgentOverride?: AppState["composerMentionAgentOverride"]
  snapshot: Pick<AppState["snapshot"], "display" | "session" | "commands" | "agents" | "mcpResources" | "skillCatalog">
}

export function buildComposerMenuItems(state: ComposerMenuState, files: ComposerPathResult[]): ComposerAutocompleteItem[] {
  const slashItems: ComposerAutocompleteItem[] = [
    {
      id: "slash-new",
      label: "new",
      detail: "在此工作区开启新会话。",
      keywords: ["session", "fresh", "conversation"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-compact",
      label: "compact",
      detail: "立即用当前模型总结此会话。",
      keywords: ["summarize", "summary", "compress", "session"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-model",
      label: "model",
      detail: "为当前智能体打开模型选择器。",
      keywords: ["switch", "provider", "variant", "llm"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-theme",
      label: "theme",
      detail: "打开会话面板的主题选择器。",
      keywords: ["switch", "appearance", "panel", "claude", "codex"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-sessions",
      label: "sessions",
      detail: "打开此工作区的会话选择器。",
      keywords: ["switch", "session", "related", "workspace", "tags"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-undo",
      label: "undo",
      detail: "立即撤销上一轮用户消息。",
      keywords: ["revert", "previous", "message", "back"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-refresh",
      label: "refresh",
      detail: "请求宿主重新加载当前会话快照。",
      keywords: ["reload", "snapshot", "panel", "host"],
      trigger: "slash",
      kind: "action",
    },
    {
      id: "slash-skills",
      label: "skills",
      detail: "打开技能选择器并插入技能命令。",
      keywords: ["skill", "picker", "workflow"],
      trigger: "slash",
      kind: "action",
    },
  ]

  if (state.snapshot.session?.revert?.messageID) {
    slashItems.push({
      id: "slash-redo",
      label: "redo",
      detail: "立即恢复先前撤销的消息。",
      keywords: ["unrevert", "restore", "forward"],
      trigger: "slash",
      kind: "action",
    })
  }

  if (state.composerAgentOverride || state.composerMentionAgentOverride) {
    slashItems.push({
      id: "slash-reset-agent",
      label: "reset-agent",
      detail: "将输入框恢复为默认智能体。",
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
      detail: localizeCommandDescription(cmd.name, cmd.description ?? "", cmd.source === "mcp"),
      keywords: [cmd.source ?? "", cmd.agent ?? ""].filter(Boolean),
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
          detail: localizeCommandDescription(item.name, item.description ?? "", false),
          keywords: [item.agent ?? "", ...item.hints].filter(Boolean),
          trigger: "skill" as const,
          kind: "SKILL" as const,
        }
      : {
          id: `skill:${item.name}`,
          label: item.name,
          detail: localizeCommandDescription(item.name, item.content.trim().split(/\r?\n/)[0] ?? "", false),
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

function localizeCommandDescription(name: string, description: string, isMcp: boolean) {
  const localized = (() => {
    if (description === "guided AGENTS.md setup") return "创建/更新 AGENTS.md"
    if (description === "review changes") return "审查当前变更"
    if (description === "review outstanding items") return "审查待办事项"
    if (description === "debug current issue") return "调试当前问题"
    if (description === "show current status") return "显示当前状态"
    if (name === "init") return "创建/更新 AGENTS.md"
    if (name === "review" && description.includes("[commit|branch|pr]")) return "审查变更 [commit|branch|pr]"
    if (name === "review") return "审查当前变更"
    if (name === "debug") return "调试当前问题"
    if (name === "status") return "显示当前状态"
    if (description) return description
    return ""
  })()

  if (isMcp) {
    return localized ? `${localized} :mcp` : ":mcp"
  }

  return localized
}
