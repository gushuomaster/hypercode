import { createProductSnapshot, deriveProductStatus, projectProductEvent, projectProductMessage, reduceProductEvent, type PendingInteractionInput, type ProductEvent, type ProductMessage, type ProductSnapshot } from "@opencode-ai/product"

type InteractionInput = {
  status?: { type: string }
  permissions: Array<{ id: string; sessionID?: string }>
  questions: Array<{ id: string; sessionID?: string }>
}

type SessionInput = InteractionInput & {
  sessionID: string
  messages: Array<{
    id: string
    sessionID?: string
    role?: ProductMessage["role"]
    time?: { created?: number }
  }>
  parts: Record<string, unknown[]>
}

export function toProductSnapshot(input: SessionInput): ProductSnapshot {
  return createProductSnapshot({
    ...toPendingInteractionInput(input),
    messages: input.messages.map((message) => projectProductMessage({
      id: message.id,
      sessionID: message.sessionID ?? input.sessionID,
      role: message.role,
      createdAt: message.time?.created,
      parts: input.parts[message.id] ?? [],
    })),
  })
}

export function toPendingInteractionInput(input: InteractionInput): PendingInteractionInput {
  return {
    status: deriveProductStatus(input.status?.type),
    permissions: input.permissions.map((request) => ({ id: request.id, ...(request.sessionID ? { sessionID: request.sessionID } : {}) })),
    questions: input.questions.map((request) => ({ id: request.id, ...(request.sessionID ? { sessionID: request.sessionID } : {}) })),
  }
}

export function toProductEvent(input: unknown): ProductEvent | undefined {
  return projectProductEvent(input)
}

export function reduceTuiProductEvent(snapshot: ProductSnapshot, input: unknown): ProductSnapshot {
  const event = toProductEvent(input)
  if (!event) return snapshot
  return reduceProductEvent(snapshot, event)
}
