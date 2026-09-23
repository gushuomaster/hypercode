import type { ProductTextKey } from "./text"

export type ProductRunState = "idle" | "running" | "retry" | "aborted" | "error"

export type ProductStatus = ProductRunState

export type ProductRequest = {
  id: string
  sessionID?: string
}

export type ProductToolStatus = "pending" | "running" | "completed" | "error"

export type ProductSubagentStatus = ProductToolStatus

export type ProductToolPart = {
  name: string
  callID?: string
  status: ProductToolStatus
  title?: string
  input?: Record<string, unknown>
  output?: string
  error?: string
}

export type ProductSubagentPart = {
  agent?: string
  childSessionID?: string
  status: ProductSubagentStatus
}

export type ProductPart = {
  id: string
  messageID: string
  sessionID?: string
  type: string
  index?: number
  fields?: Record<string, unknown>
  tool?: ProductToolPart
  subagent?: ProductSubagentPart
}

export type ProductMessage = {
  id: string
  sessionID?: string
  role?: "user" | "assistant" | "system"
  createdAt?: number
  parts: ProductPart[]
}

export type ProductToolState = ProductToolPart & {
  id: string
  messageID: string
  sessionID?: string
}

export type ProductSubagentState = ProductSubagentPart & {
  id: string
  messageID: string
  sessionID?: string
}

export type ProductRetry = {
  attempt: number
  message: string
  nextAt?: number
}

export type ProductError = {
  message: string
  raw?: string
  code?: string
  textKey?: ProductTextKey
}

export type ProductSnapshot = {
  status: ProductRunState
  messages: ProductMessage[]
  tools: ProductToolState[]
  subagents: ProductSubagentState[]
  permissions: ProductRequest[]
  questions: ProductRequest[]
  resolved: {
    permissions: string[]
    questions: string[]
  }
  retry?: ProductRetry
  error?: ProductError
}

export type PendingInteraction =
  | { kind: "permission"; requestID: string }
  | { kind: "question"; requestID: string }
  | { kind: "status"; status: Exclude<ProductRunState, "idle"> }

export type PendingInteractionInput = Pick<ProductSnapshot, "permissions" | "questions" | "status">

export function createProductSnapshot(input: Partial<ProductSnapshot> = {}): ProductSnapshot {
  const messages = input.messages ?? []
  const states = deriveProductPartStates(messages)
  return {
    status: input.status ?? "idle",
    messages,
    tools: input.tools ?? states.tools,
    subagents: input.subagents ?? states.subagents,
    permissions: input.permissions ?? [],
    questions: input.questions ?? [],
    resolved: input.resolved ?? {
      permissions: [],
      questions: [],
    },
    ...(input.retry ? { retry: input.retry } : {}),
    ...(input.error ? { error: input.error } : {}),
  }
}

export function mergeProductSnapshot(current: ProductSnapshot | undefined, next: ProductSnapshot): ProductSnapshot {
  if (!current) return next
  const resolvedPermissions = [...new Set([...current.resolved.permissions, ...next.resolved.permissions])].sort()
  const resolvedQuestions = [...new Set([...current.resolved.questions, ...next.resolved.questions])].sort()
  return {
    ...next,
    permissions: next.permissions.filter((item) => !resolvedPermissions.includes(item.id)),
    questions: next.questions.filter((item) => !resolvedQuestions.includes(item.id)),
    resolved: {
      permissions: resolvedPermissions,
      questions: resolvedQuestions,
    },
    ...(next.status === "error" && !next.error && current.error ? { error: current.error } : {}),
    ...(next.status === "retry" && !next.retry && current.retry ? { retry: current.retry } : {}),
  }
}

export function mergePartialProductSnapshot(
  current: ProductSnapshot | undefined,
  next: ProductSnapshot,
  hydrated: Partial<Record<"status" | "permissions" | "questions", boolean>>,
): ProductSnapshot {
  if (!current) return next
  const preserveStatus = hydrated.status === false
  return mergeProductSnapshot(current, {
    ...next,
    status: preserveStatus ? current.status : next.status,
    permissions: hydrated.permissions === false ? current.permissions : next.permissions,
    questions: hydrated.questions === false ? current.questions : next.questions,
    ...(preserveStatus && current.retry ? { retry: current.retry } : {}),
    ...(preserveStatus && current.error ? { error: current.error } : {}),
  })
}

export function projectProductMessage(input: {
  id: string
  sessionID?: string
  role?: ProductMessage["role"]
  createdAt?: number
  parts?: unknown[]
}): ProductMessage {
  return {
    id: input.id,
    sessionID: input.sessionID,
    role: input.role,
    createdAt: input.createdAt,
    parts: (input.parts ?? []).map(projectProductPart).filter((part): part is ProductPart => !!part),
  }
}

export function projectProductPart(input: unknown): ProductPart | undefined {
  if (!isRecord(input)) return
  if (typeof input.id !== "string" || typeof input.messageID !== "string" || typeof input.type !== "string") return
  const tool = toolPart(input)
  const subagent = subagentPart(input)
  return {
    id: input.id,
    messageID: input.messageID,
    sessionID: typeof input.sessionID === "string" ? input.sessionID : undefined,
    type: input.type === "agent" || input.type === "subtask" ? "subagent" : input.type,
    fields: Object.fromEntries(Object.entries(input).filter(([key]) => !["id", "messageID", "sessionID", "type"].includes(key))),
    ...(tool ? { tool } : {}),
    ...(subagent ? { subagent } : {}),
  }
}

export function deriveProductPartStates(messages: ProductMessage[]) {
  return {
    tools: messages.flatMap((message) => message.parts.flatMap((part) => part.tool ? [{
      id: part.id,
      messageID: part.messageID,
      sessionID: part.sessionID,
      ...part.tool,
    }] : [])),
    subagents: messages.flatMap((message) => message.parts.flatMap((part) => part.subagent ? [{
      id: part.id,
      messageID: part.messageID,
      sessionID: part.sessionID,
      ...part.subagent,
    }] : [])),
  }
}

function toolPart(input: Record<string, unknown>): ProductToolPart | undefined {
  if (input.type !== "tool" || typeof input.tool !== "string" || !isRecord(input.state)) return
  return {
    name: input.tool,
    ...(typeof input.callID === "string" ? { callID: input.callID } : {}),
    status: toolStatus(input.state.status),
    ...(typeof input.state.title === "string" ? { title: input.state.title } : {}),
    ...(isRecord(input.state.input) ? { input: input.state.input } : {}),
    ...(typeof input.state.output === "string" ? { output: input.state.output } : {}),
    ...(typeof input.state.error === "string" ? { error: input.state.error } : {}),
  }
}

function subagentPart(input: Record<string, unknown>): ProductSubagentPart | undefined {
  if (input.type !== "agent" && input.type !== "subtask" && input.type !== "subagent") return
  const state = isRecord(input.state) ? input.state : undefined
  return {
    ...(typeof input.agent === "string" ? { agent: input.agent } : {}),
    ...(typeof input.childSessionID === "string" ? { childSessionID: input.childSessionID } : {}),
    status: toolStatus(state?.status ?? input.status),
  }
}

function toolStatus(value: unknown): ProductToolStatus {
  if (value === "running" || value === "completed" || value === "error") return value
  return "pending"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
