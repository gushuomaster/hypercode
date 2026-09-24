import type { SessionBootstrap } from "../../../bridge/types"
import { cycleModelVariant, deriveComposerSelection, type ProductFormatterState, type ProductLspState, type ProductMcpState } from "@opencode-ai/product"
import type { AgentInfo, FormatterStatus, LspStatus, McpStatus, MessageInfo, ProviderInfo, SessionMessage } from "../../../core/sdk"
import { displaySessionTitle } from "../../../core/session-titles"
import { t } from "../../../i18n"
import { toProductAgents, toProductProviders } from "./product-adapter"

export type ModelRef = NonNullable<MessageInfo["model"]>

export type StatusTone = "green" | "orange" | "red" | "gray"

export type StatusItem = {
  name: string
  tone: StatusTone
  value: string
  action?: "connect" | "disconnect" | "reconnect" | "authenticate" | "removeAuth"
  actionLabel?: string
}

export function sessionTitle(bootstrap: SessionBootstrap) {
  return displaySessionTitle(bootstrap.session?.title, bootstrap.sessionRef.sessionId?.slice(0, 8) || "session")
}

export function contextUsage(messages: SessionMessage[], providers: ProviderInfo[], fallbackModel?: MessageInfo["model"]) {
  const info = lastAssistantWithOutput(messages)?.info
  const tokens = totalTokens(info)
  if (!info || tokens <= 0) {
    return undefined
  }

  const limit = modelContextLimit(info, providers) ?? modelContextLimitForRef(fallbackModel, providers)
  return {
    tokens,
    percent: typeof limit === "number" && limit > 0 ? Math.round(tokens / limit * 100) : undefined,
  }
}

export function sessionCost(messages: SessionMessage[]) {
  return messages.reduce((acc, item) => item.info.role === "assistant" ? acc + (item.info.cost ?? 0) : acc, 0)
}

export function totalTokens(info?: MessageInfo) {
  const tokens = info?.tokens
  if (!tokens) {
    return 0
  }
  return tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
}

export function modelContextLimit(info: MessageInfo | undefined, providers: ProviderInfo[]) {
  return modelContextLimitForRef(info?.model, providers)
}

export function modelContextLimitForRef(model: MessageInfo["model"] | undefined, providers: ProviderInfo[]) {
  const providerID = model?.providerID?.trim()
  const modelID = model?.modelID?.trim()
  if (!providerID || !modelID) {
    return undefined
  }

  const provider = providerById(providers, providerID)
  const providerModel = providerModelById(provider, modelID)
  return providerModel?.limit?.context
}

export function providerById(providers: ProviderInfo[], providerID?: string) {
  return providers.find((item) => item.id === providerID)
}

export function normalizeModelRef(model: MessageInfo["model"] | undefined): ModelRef | undefined {
  const providerID = model?.providerID?.trim()
  const modelID = model?.modelID?.trim()
  if (!providerID || !modelID) {
    return undefined
  }

  return { providerID, modelID }
}

export function modelKey(model: MessageInfo["model"] | undefined) {
  const normalized = normalizeModelRef(model)
  return normalized ? `${normalized.providerID}/${normalized.modelID}` : ""
}

export function sameModelRef(left: MessageInfo["model"] | undefined, right: MessageInfo["model"] | undefined) {
  const a = normalizeModelRef(left)
  const b = normalizeModelRef(right)
  return !!a && !!b && a.providerID === b.providerID && a.modelID === b.modelID
}

export function isValidModelRef(providers: ProviderInfo[], model: MessageInfo["model"] | undefined): model is ModelRef {
  const normalized = normalizeModelRef(model)
  if (!normalized) {
    return false
  }

  return !!providerModelById(providerById(providers, normalized.providerID), normalized.modelID)
}

export function pushRecentModel(recents: ModelRef[], model: MessageInfo["model"] | undefined, limit = 10) {
  const normalized = normalizeModelRef(model)
  if (!normalized) {
    return recents
  }

  const key = modelKey(normalized)
  const next = [normalized, ...recents.filter((item) => modelKey(item) !== key)]
  return next.slice(0, limit)
}

export function toggleFavoriteModel(favorites: ModelRef[], model: MessageInfo["model"] | undefined) {
  const normalized = normalizeModelRef(model)
  if (!normalized) {
    return favorites
  }

  const key = modelKey(normalized)
  const exists = favorites.some((item) => modelKey(item) === key)
  if (exists) {
    return favorites.filter((item) => modelKey(item) !== key)
  }

  return [normalized, ...favorites]
}

export function modelVariants(providers: ProviderInfo[], model: MessageInfo["model"] | undefined) {
  const normalized = normalizeModelRef(model)
  if (!normalized) {
    return []
  }

  const info = providerModelById(providerById(providers, normalized.providerID), normalized.modelID)
  return Object.keys(info?.variants ?? {})
}

export function cycleComposerModelVariant(providers: ProviderInfo[], model: MessageInfo["model"] | undefined, current?: string) {
  return cycleModelVariant(toProductProviders(providers), normalizeModelRef(model), current)
}

export function cycleComposerModelVariantState(
  providers: ProviderInfo[],
  model: MessageInfo["model"] | undefined,
  current: string | undefined,
  variants: Record<string, string>,
) {
  const key = modelKey(model)
  if (!key || modelVariants(providers, model).length === 0) return variants
  return {
    ...variants,
    [key]: cycleComposerModelVariant(providers, model, current) ?? "default",
  }
}

export function displayModelRef(model: MessageInfo["model"] | undefined, providers: ProviderInfo[]) {
  const providerID = model?.providerID?.trim()
  const modelID = model?.modelID?.trim()
  if (!modelID) {
    return ""
  }
  const provider = providerById(providers, providerID)
  return providerModelById(provider, modelID)?.name || modelID
}

export function displayProviderRef(model: MessageInfo["model"] | undefined, providers: ProviderInfo[]) {
  const providerID = model?.providerID?.trim()
  if (!providerID) {
    return ""
  }
  return providerById(providers, providerID)?.name || providerID
}

export function lastUserMessage(messages: SessionMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.info.role === "user") {
      return messages[i]
    }
  }
}

export function providerModelById(provider: ProviderInfo | undefined, modelID: string) {
  if (!provider?.models || !modelID) {
    return undefined
  }

  return provider.models[modelID] || Object.values(provider.models).find((item) => item.id === modelID)
}

export function lastAssistantWithOutput(messages: SessionMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i]
    if (item?.info.role === "assistant" && (item.info.tokens?.output ?? 0) > 0) {
      return item
    }
  }
}

export function formatUsd(value: number) {
  return `$${value.toFixed(4)}`
}

export function overallMcpStatus(statuses: Record<string, McpStatus>) {
  const items = Object.entries(statuses)
    .map(([name, status]) => statusItemForMcp(name, status))

  if (items.length === 0) {
    return { tone: "gray" as const, items: [] }
  }

  const ok = items.filter((item) => item.tone === "green").length
  const warn = items.filter((item) => item.tone === "orange").length
  const err = items.filter((item) => item.tone === "red").length
  if (ok === items.length) {
    return { tone: "green" as const, items }
  }
  if (err > 0 && ok === 0 && warn === 0) {
    return { tone: "red" as const, items }
  }
  return { tone: "orange" as const, items }
}

export function overallLspStatus(statuses: LspStatus[]) {
  const items = statuses.map(statusItemForLsp)
  if (items.length === 0) {
    return { tone: "gray" as const, items: [] }
  }

  const ok = items.filter((item) => item.tone === "green").length
  if (ok === items.length) {
    return { tone: "green" as const, items }
  }
  if (ok === 0) {
    return { tone: "red" as const, items }
  }
  return { tone: "orange" as const, items }
}

export function overallFormatterStatus(statuses: FormatterStatus[]) {
  const items = statuses.map((status) => ({
    name: status.name,
    tone: status.enabled ? "green" as const : "gray" as const,
    value: status.enabled ? status.extensions.join(", ") || t("common.enabled") : t("common.disabled"),
  }))

  if (items.length === 0) {
    return { tone: "gray" as const, items: [] }
  }

  const enabled = items.filter((item) => item.tone === "green").length
  if (enabled === items.length) {
    return { tone: "green" as const, items }
  }
  if (enabled === 0) {
    return { tone: "gray" as const, items }
  }
  return { tone: "orange" as const, items }
}

export function statusItemForMcp(name: string, status: McpStatus): StatusItem {
  if (status.status === "connected") {
    return { name, tone: "green", value: t("status.connected"), action: "disconnect", actionLabel: t("status.disconnect", { name }) }
  }
  if (status.status === "disabled") {
    return { name, tone: "gray", value: t("common.disabled"), action: "connect", actionLabel: t("status.connect", { name }) }
  }
  if (status.status === "needs_auth") {
    return { name, tone: "orange", value: t("status.needsAuthentication"), action: "authenticate", actionLabel: t("status.authenticate", { name }) }
  }
  if (status.status === "needs_client_registration") {
    return { name, tone: "red", value: status.error || t("status.clientRegistrationRequired"), action: "reconnect", actionLabel: t("status.reconnect", { name }) }
  }
  return { name, tone: "red", value: status.error || t("common.error"), action: "reconnect", actionLabel: t("status.reconnect", { name }) }
}

export function overallProductFormatterStatus(states: ProductFormatterState[]) {
  const items = states.map((state): StatusItem => ({
    name: state.name,
    tone: state.severity === "warning" ? "orange" : "green",
    value: state.enabled ? state.extensions.join(", ") || t("common.enabled") : t("common.disabled"),
  }))
  if (items.length === 0) return { tone: "gray" as const, items }
  if (items.every((item) => item.tone === "green")) return { tone: "green" as const, items }
  if (items.every((item) => item.tone === "orange")) return { tone: "orange" as const, items }
  return { tone: "orange" as const, items }
}

export function overallProductMcpStatus(states: ProductMcpState[]) {
  const items = states.map(statusItemForProductMcp)
  if (items.length === 0) return { tone: "gray" as const, items }
  if (items.every((item) => item.tone === "green" || item.tone === "gray")) {
    return { tone: items.some((item) => item.tone === "green") ? "green" as const : "gray" as const, items }
  }
  if (items.every((item) => item.tone === "red")) return { tone: "red" as const, items }
  return { tone: "orange" as const, items }
}

export function statusItemForProductMcp(state: ProductMcpState): StatusItem {
  const tone = state.severity === "error" ? "red" : state.severity === "warning" ? "orange" : state.availability === "connected" ? "green" : "gray"
  return {
    name: state.name,
    tone,
    value: state.diagnostic?.message ?? state.availability,
    ...(state.action ? { action: state.action, actionLabel: state.action } : {}),
  }
}

export function overallProductLspStatus(states: ProductLspState[]) {
  const items = states.map((state): StatusItem => ({
    name: state.name,
    tone: state.severity === "error" ? "red" : "green",
    value: state.diagnostic?.message ?? state.root,
  }))
  if (items.length === 0) return { tone: "gray" as const, items }
  if (items.every((item) => item.tone === "green")) return { tone: "green" as const, items }
  if (items.every((item) => item.tone === "red")) return { tone: "red" as const, items }
  return { tone: "orange" as const, items }
}

export function statusItemForLsp(status: LspStatus): StatusItem {
  return {
    name: status.name,
    tone: status.status === "connected" ? "green" : "red",
    value: status.root || ".",
  }
}

export function agentColor(name: string) {
  const palette = agentPalette()
  return palette[agentColorIndex(name)]
}

export function agentColorClass(name: string) {
  return `oc-agentColor-${agentColorIndex(name)}`
}

function agentColorIndex(name: string) {
  let hash = 0
  for (const char of name) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0
  }
  return Math.abs(hash) % agentPalette().length
}

function agentPalette() {
  return [
    "#9ece6a",
    "#6ab5ce",
    "#6a8cce",
    "#a06ace",
    "#ce6ab5",
    "#ce8c6a",
    "#ceb56a",
  ]
}

export function composerIdentity(snapshot: {
  messages: SessionMessage[]
  agents: AgentInfo[]
  defaultAgent?: string
  providers: ProviderInfo[]
  providerDefault?: Record<string, string>
  configuredModel?: {
    providerID: string
    modelID: string
  }
  agentMode: "build" | "plan"
  composerAgentOverride?: string
  composerMentionAgentOverride?: string
  composerRecentModels?: ModelRef[]
  composerModelOverrides?: Record<string, ModelRef>
  composerModelVariants?: Record<string, string>
}) {
  const selection = composerSelection(snapshot)
  const lastUser = lastUserMessage(snapshot.messages)
  return {
    agent: selection.agent || lastUser?.info.agent?.trim() || snapshot.agentMode,
    model: displayModelRef(selection.model, snapshot.providers) || displayModelRef(lastUser?.info.model, snapshot.providers) || "",
    provider: displayProviderRef(selection.model, snapshot.providers) || displayProviderRef(lastUser?.info.model, snapshot.providers) || "",
    modelRef: selection.model,
    variant: selection.variant || lastUser?.info.variant?.trim() || "",
  }
}

export function composerSelection(snapshot: {
  messages: SessionMessage[]
  agents: AgentInfo[]
  defaultAgent?: string
  agentMode?: "build" | "plan"
  providers: ProviderInfo[]
  providerDefault?: Record<string, string>
  configuredModel?: {
    providerID: string
    modelID: string
  }
  composerAgentOverride?: string
  composerMentionAgentOverride?: string
  composerRecentModels?: ModelRef[]
  composerModelOverrides?: Record<string, ModelRef>
  composerModelVariants?: Record<string, string>
}) {
  return deriveComposerSelection({
    providers: toProductProviders(snapshot.providers),
    agents: toProductAgents(snapshot.agents),
    defaultAgent: snapshot.defaultAgent,
    agentMode: snapshot.agentMode,
    messagesExist: snapshot.messages.length > 0,
    configuredModel: snapshot.configuredModel,
    providerDefaults: snapshot.providerDefault,
    recentModels: snapshot.composerRecentModels,
    modelOverrides: snapshot.composerModelOverrides,
    mentionAgentOverride: snapshot.composerMentionAgentOverride,
    agentOverride: snapshot.composerAgentOverride,
    modelVariants: snapshot.composerModelVariants,
  })
}

export function lastUserSelection(messages: SessionMessage[], providers: ProviderInfo[]) {
  const message = lastUserMessage(messages)
  if (!message) {
    return undefined
  }

  const model = isValidModelRef(providers, message.info.model) ? message.info.model : undefined
  return {
    messageID: message.info.id,
    agent: message.info.agent?.trim() || undefined,
    model,
    variant: message.info.variant?.trim() || undefined,
  }
}

export function composerMetrics(snapshot: {
  messages: SessionMessage[]
  providers: ProviderInfo[]
  model?: MessageInfo["model"]
}) {
  const context = contextUsage(snapshot.messages, snapshot.providers, snapshot.model)
  return {
    tokens: context?.tokens ?? 0,
    percent: context?.percent,
    cost: sessionCost(snapshot.messages),
  }
}
