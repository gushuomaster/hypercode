import { deriveProductStatus } from "./interaction"
import { projectProductMessage, projectProductPart, type ProductError, type ProductMessage, type ProductPart, type ProductRequest, type ProductRetry, type ProductRunState } from "./snapshot"
import { deriveProductErrorTextKey } from "./text"

type ProductEventPayload =
  | { type: "session.status"; status: ProductRunState }
  | { type: "session.retry"; retry: ProductRetry }
  | { type: "session.aborted"; message: string; raw?: string }
  | { type: "session.error"; error: ProductError }
  | { type: "message.updated"; message: ProductMessage }
  | { type: "message.removed"; messageID: string }
  | { type: "message.part.updated"; part: ProductPart }
  | { type: "message.part.delta"; messageID: string; partID: string; field: string; delta: string }
  | { type: "message.part.removed"; messageID: string; partID: string }
  | { type: "permission.asked"; request: ProductRequest }
  | { type: "permission.replied"; requestID: string }
  | { type: "question.asked"; request: ProductRequest }
  | { type: "question.replied" | "question.rejected"; requestID: string }

export type ProductEvent = ProductEventPayload & {
  sessionID?: string
}

export function projectProductEvent(input: unknown): ProductEvent | undefined {
  if (!isRecord(input) || typeof input.type !== "string" || !isRecord(input.properties)) return
  const properties = input.properties
  const sessionID = typeof properties.sessionID === "string" ? properties.sessionID : undefined

  if (input.type === "session.status" && isRecord(properties.status)) {
    if (properties.status.type === "retry") {
      return {
        type: "session.retry",
        sessionID,
        retry: {
          attempt: typeof properties.status.attempt === "number" ? properties.status.attempt : 0,
          message: typeof properties.status.message === "string" ? properties.status.message : "",
          ...(typeof properties.status.next === "number" ? { nextAt: properties.status.next } : {}),
        },
      }
    }
    return { type: "session.status", sessionID, status: deriveProductStatus(stringValue(properties.status.type)) }
  }

  if (input.type === "session.error") {
    const error = isRecord(properties.error) ? properties.error : {}
    const data = isRecord(error.data) ? error.data : {}
    const message = stringValue(data.message) ?? stringValue(error.message) ?? "Unknown error"
    if (error.name === "MessageAbortedError") {
      return { type: "session.aborted", sessionID, message, raw: message }
    }
    return {
      type: "session.error",
      sessionID,
      error: {
        ...(typeof error.name === "string" ? { code: error.name } : {}),
        message,
        raw: message,
        textKey: deriveProductErrorTextKey(stringValue(error.name), message),
      },
    }
  }

  if (input.type === "message.updated" && isRecord(properties.info) && typeof properties.info.id === "string") {
    return {
      type: "message.updated",
      sessionID: stringValue(properties.info.sessionID),
      message: projectProductMessage({
        id: properties.info.id,
        sessionID: stringValue(properties.info.sessionID),
        role: messageRole(properties.info.role),
        createdAt: isRecord(properties.info.time) && typeof properties.info.time.created === "number"
          ? properties.info.time.created
          : undefined,
      }),
    }
  }

  if (input.type === "message.removed" && typeof properties.messageID === "string") {
    return { type: "message.removed", sessionID, messageID: properties.messageID }
  }

  if (input.type === "message.part.updated") {
    const part = projectProductPart(properties.part)
    if (!part) return
    return { type: "message.part.updated", sessionID: part.sessionID, part }
  }

  if (input.type === "message.part.delta" && typeof properties.messageID === "string" && typeof properties.partID === "string" && typeof properties.field === "string" && typeof properties.delta === "string") {
    return {
      type: "message.part.delta",
      sessionID,
      messageID: properties.messageID,
      partID: properties.partID,
      field: properties.field,
      delta: properties.delta,
    }
  }

  if (input.type === "message.part.removed" && typeof properties.messageID === "string" && typeof properties.partID === "string") {
    return { type: "message.part.removed", sessionID, messageID: properties.messageID, partID: properties.partID }
  }

  if (input.type === "permission.asked" && typeof properties.id === "string") {
    return { type: "permission.asked", sessionID, request: { id: properties.id, sessionID } }
  }

  if (input.type === "permission.replied" && typeof properties.requestID === "string") {
    return { type: "permission.replied", sessionID, requestID: properties.requestID }
  }

  if (input.type === "question.asked" && typeof properties.id === "string") {
    return { type: "question.asked", sessionID, request: { id: properties.id, sessionID } }
  }

  if ((input.type === "question.replied" || input.type === "question.rejected") && typeof properties.requestID === "string") {
    return { type: input.type, sessionID, requestID: properties.requestID }
  }
}

function messageRole(value: unknown): ProductMessage["role"] {
  if (value === "user" || value === "assistant" || value === "system") return value
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
