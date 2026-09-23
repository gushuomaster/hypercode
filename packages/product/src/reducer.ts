import type { ProductEvent } from "./event"
import { deriveProductPartStates, type ProductMessage, type ProductPart, type ProductSnapshot } from "./snapshot"

export function reduceProductEvent(snapshot: ProductSnapshot, event: ProductEvent): ProductSnapshot {
  if (event.type === "session.status") {
    if (event.status === "retry") return { ...snapshot, status: event.status }
    return withoutRunFailure({ ...snapshot, status: event.status })
  }
  if (event.type === "session.retry") {
    const next = { ...snapshot, status: "retry" as const, retry: event.retry }
    delete next.error
    return next
  }
  if (event.type === "session.aborted") {
    const next = {
      ...snapshot,
      status: "aborted" as const,
      error: { message: event.message, ...(event.raw ? { raw: event.raw } : {}) },
    }
    delete next.retry
    return next
  }
  if (event.type === "session.error") {
    const next = { ...snapshot, status: "error" as const, error: event.error }
    delete next.retry
    return next
  }
  if (event.type === "message.updated") {
    return projectParts({
      ...snapshot,
      messages: upsertMessage(snapshot.messages, event.message),
    })
  }
  if (event.type === "message.removed") {
    return projectParts({
      ...snapshot,
      messages: snapshot.messages.filter((message) => message.id !== event.messageID),
    })
  }
  if (event.type === "message.part.updated") {
    return projectParts({
      ...snapshot,
      messages: upsertPart(snapshot.messages, event.part),
    })
  }
  if (event.type === "message.part.delta") {
    return projectParts({
      ...snapshot,
      messages: appendPartDelta(snapshot.messages, event),
    })
  }
  if (event.type === "message.part.removed") {
    return projectParts({
      ...snapshot,
      messages: removePart(snapshot.messages, event.messageID, event.partID),
    })
  }
  if (event.type === "permission.asked") {
    if (snapshot.resolved.permissions.includes(event.request.id)) return snapshot
    return { ...snapshot, permissions: upsert(snapshot.permissions, event.request) }
  }
  if (event.type === "permission.replied") {
    return {
      ...snapshot,
      permissions: snapshot.permissions.filter((request) => request.id !== event.requestID),
      resolved: {
        ...snapshot.resolved,
        permissions: addResolved(snapshot.resolved.permissions, event.requestID),
      },
    }
  }
  if (event.type === "question.asked") {
    if (snapshot.resolved.questions.includes(event.request.id)) return snapshot
    return { ...snapshot, questions: upsert(snapshot.questions, event.request) }
  }
  return {
    ...snapshot,
    questions: snapshot.questions.filter((request) => request.id !== event.requestID),
    resolved: {
      ...snapshot.resolved,
      questions: addResolved(snapshot.resolved.questions, event.requestID),
    },
  }
}

function withoutRunFailure(snapshot: ProductSnapshot) {
  const next = { ...snapshot }
  delete next.error
  delete next.retry
  return next
}

function upsertMessage(messages: ProductMessage[], message: ProductMessage) {
  const existing = messages.find((entry) => entry.id === message.id)
  const next = existing
    ? messages.map((entry) => entry.id === message.id ? { ...message, parts: existing.parts } : entry)
    : [...messages, message]
  return [...next].sort((left, right) => (left.createdAt ?? Number.MAX_SAFE_INTEGER) - (right.createdAt ?? Number.MAX_SAFE_INTEGER) || compare(left.id, right.id))
}

function upsertPart(messages: ProductMessage[], part: ProductPart) {
  const exists = messages.some((message) => message.id === part.messageID)
  const source = exists
    ? messages
    : [...messages, { id: part.messageID, sessionID: part.sessionID, parts: [] }]
  return source.map((message) => {
    if (message.id !== part.messageID) return message
    return {
      ...message,
      parts: [...upsert(message.parts, part)].sort((left, right) => (left.index ?? Number.MAX_SAFE_INTEGER) - (right.index ?? Number.MAX_SAFE_INTEGER) || compare(left.id, right.id)),
    }
  })
}

function appendPartDelta(
  messages: ProductMessage[],
  event: Extract<ProductEvent, { type: "message.part.delta" }>,
) {
  return messages.map((message) => {
    if (message.id !== event.messageID) return message
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.id !== event.partID) return part
        const value = part.fields?.[event.field]
        if (typeof value !== "string") return part
        return {
          ...part,
          fields: {
            ...part.fields,
            [event.field]: value + event.delta,
          },
        }
      }),
    }
  })
}

function removePart(messages: ProductMessage[], messageID: string, partID: string) {
  return messages.map((message) => message.id === messageID
    ? { ...message, parts: message.parts.filter((part) => part.id !== partID) }
    : message)
}

function projectParts(snapshot: ProductSnapshot): ProductSnapshot {
  const states = deriveProductPartStates(snapshot.messages)
  return {
    ...snapshot,
    tools: states.tools,
    subagents: states.subagents,
  }
}

function addResolved(items: string[], id: string) {
  if (items.includes(id)) return items
  return [...items, id].sort(compare)
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  if (!items.some((entry) => entry.id === item.id)) return [...items, item].sort((left, right) => compare(left.id, right.id))
  return items.map((entry) => entry.id === item.id ? item : entry)
}

function compare(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
