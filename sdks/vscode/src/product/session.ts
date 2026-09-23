import {
  createProductSnapshot,
  deriveProductStatus,
  mergeProductSnapshot,
  projectProductEvent,
  projectProductMessage,
  type PendingInteractionInput,
  type ProductEvent,
  type ProductMessage,
  type ProductSessionInput,
  type ProductSnapshot,
} from "@opencode-ai/product"

type InteractionInput = {
  sessionStatus?: { type: string }
  permissions: Array<{ id: string; sessionID?: string }>
  questions: Array<{ id: string; sessionID?: string }>
}

type SessionInput = InteractionInput & {
  messages: Array<{
    info: {
      id: string
      sessionID?: string
      role?: ProductMessage["role"]
      time?: { created?: number }
    }
    parts: unknown[]
  }>
}

export function toProductSnapshot(input: SessionInput): ProductSnapshot {
  return createProductSnapshot({
    ...toPendingInteractionInput(input),
    messages: input.messages.map((message) => projectProductMessage({
      id: message.info.id,
      sessionID: message.info.sessionID,
      role: message.info.role,
      createdAt: message.info.time?.created,
      parts: message.parts,
    })),
  })
}

export function mergeSessionProductSnapshot(current: ProductSnapshot | undefined, input: SessionInput) {
  return mergeProductSnapshot(current, toProductSnapshot(input))
}

export function toPendingInteractionInput(input: InteractionInput): PendingInteractionInput {
  return {
    status: deriveProductStatus(input.sessionStatus?.type),
    permissions: input.permissions.map((request) => ({ id: request.id, ...(request.sessionID ? { sessionID: request.sessionID } : {}) })),
    questions: input.questions.map((request) => ({ id: request.id, ...(request.sessionID ? { sessionID: request.sessionID } : {}) })),
  }
}

export function toProductEvent(input: unknown): ProductEvent | undefined {
  return projectProductEvent(input)
}

export function toProductSessionInput(
  session: {
    id: string
    title?: string
    parentID?: string
    time: { created?: number; updated: number; archived?: number }
  },
  status?: { type: string },
  tags?: string[],
): ProductSessionInput {
  return {
    id: session.id,
    title: session.title,
    parentID: session.parentID,
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    archivedAt: session.time.archived,
    status: status?.type,
    tags,
  }
}
