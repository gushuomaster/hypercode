import type { MessagePart, QuestionInfo } from "../../../core/sdk"
import { t } from "../../../i18n"

export function textValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function recordValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

export function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export function questionInfoList(value: unknown) {
  if (!Array.isArray(recordValue(value).questions)) {
    return [] as QuestionInfo[]
  }
  return recordValue(value).questions as QuestionInfo[]
}

export function questionAnswerGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[][]
  }
  return value.map((item) => stringList(item))
}

export function capitalize(value: string) {
  if (!value) {
    return ""
  }
  return value[0].toUpperCase() + value.slice(1)
}

export function formatToolName(value: string) {
  if (!value) {
    return t("part.tool")
  }
  if (value === "lsp") {
    return "LSP"
  }
  return value
    .split("_")
    .map((part) => part.toLowerCase() === "lsp" ? "LSP" : capitalize(part))
    .join(" ")
}

export function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (!rest) {
    return `${minutes}m`
  }
  return `${minutes}m ${rest}s`
}

export function retryText(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  if (value && typeof value === "object") {
    const maybe = value as { message?: unknown }
    if (typeof maybe.message === "string") {
      return maybe.message
    }
  }

  return t("part.retryRequested")
}

export function cleanReasoning(value: string) {
  return value.replace(/\[REDACTED\]/g, "").trim()
}

export function fileLabel(value: string) {
  const normalized = value.replace(/\\/g, "/")
  return normalized.split("/").filter(Boolean).pop() || value
}

export function todoMarker(status: string) {
  if (status === "completed") {
    return "[✓]"
  }
  if (status === "in_progress") {
    return "[•]"
  }
  return "[ ]"
}

export function parentDir(value: string) {
  if (!value) {
    return ""
  }
  const normalized = value.replace(/\\/g, "/")
  const index = normalized.lastIndexOf("/")
  return index > 0 ? normalized.slice(0, index) : ""
}

export function diffSummary(value: string) {
  if (!value) {
    return t("tool.file.modified")
  }
  const additions = (value.match(/^\+/gm) || []).length
  const deletions = (value.match(/^-/gm) || []).length
  if (!additions && !deletions) {
    return t("tool.file.modified")
  }
  return `+${additions} / -${deletions}`
}

export function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "")
}

export function relativeWorkspacePath(value: string, workspaceDir: string) {
  const path = normalizePath(value)
  const root = normalizePath(workspaceDir)
  if (!path) {
    return ""
  }
  if (root && path.startsWith(root.endsWith("/") ? root : `${root}/`)) {
    return path.slice(root.length + (root.endsWith("/") ? 0 : 1))
  }
  return path
}

export function displayWorkspacePath(value: string, workspaceDir: string) {
  const path = normalizePath(value)
  const root = normalizePath(workspaceDir)
  if (path && root && path === root) {
    return "."
  }
  return relativeWorkspacePath(value, workspaceDir)
}

export function extractUrls(value: string) {
  return value.match(/https?:\/\/[^\s)]+/g) || []
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

export function formatDiagnostic(item: Record<string, unknown>) {
  const severity = stringValue(item.severity) || stringValue(item.level)
  const message = stringValue(item.message) || stringValue(item.text)
  const line = numberValue(item.line) || numberValue(item.lineNumber)
  const col = numberValue(item.column) || numberValue(item.col)
  const head = [severity, line > 0 ? `L${line}` : "", col > 0 ? `C${col}` : ""].filter(Boolean).join(" ")
  return [head, message].filter(Boolean).join(" · ")
}

export function partTitle(part: MessagePart) {
  if (part.type === "text") {
    return part.synthetic ? t("part.context") : t("part.text")
  }
  if (part.type === "reasoning") {
    return t("part.reasoning")
  }
  if (part.type === "tool") {
    return part.tool || t("part.tool")
  }
  if (part.type === "file") {
    return part.filename || t("part.attachment")
  }
  if (part.type === "step-start") {
    return t("part.stepStarted")
  }
  if (part.type === "step-finish") {
    return t("part.stepFinished")
  }
  if (part.type === "snapshot") {
    return t("part.snapshot")
  }
  if (part.type === "patch") {
    return t("part.patch")
  }
  if (part.type === "agent") {
    return t("part.agent")
  }
  if (part.type === "retry") {
    return t("part.retry")
  }
  if (part.type === "compaction") {
    return t("part.compaction")
  }
  if (part.type === "subtask") {
    return "subtask"
  }
  return part.type || t("part.part")
}

export function partMeta(part: MessagePart) {
  if (part.type === "tool") {
    const status = part.state?.status || "pending"
    return status === "pending" || status === "running" || status === "completed" || status === "error"
      ? t(`tool.status.${status}`)
      : status
  }
  if (part.type === "file") {
    return part.mime || "file"
  }
  return ""
}

export function isDividerPart(part: MessagePart) {
  return part.type === "retry"
    || part.type === "agent"
    || part.type === "subtask"
    || part.type === "step-start"
}

export function dividerText(part: MessagePart) {
  if (part.type === "retry") {
    return retryText((part as Record<string, unknown>).error) || t("part.retry")
  }

  if (part.type === "agent") {
    return textValue((part as Record<string, unknown>).name) || t("part.agentTask")
  }

  if (part.type === "subtask") {
    return textValue((part as Record<string, unknown>).description) || textValue((part as Record<string, unknown>).prompt) || t("part.subtask")
  }

  if (part.type === "step-start") {
    const model = textValue((part as Record<string, unknown>).model)
    return model ? t("part.stepStartedModel", { model }) : t("part.stepStarted")
  }

  return partTitle(part)
}
