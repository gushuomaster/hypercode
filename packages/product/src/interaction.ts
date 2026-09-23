import type { PendingInteraction, PendingInteractionInput, ProductStatus } from "./snapshot"

export function deriveProductStatus(status: string | undefined): ProductStatus {
  if (status === "busy" || status === "running") return "running"
  if (status === "retry" || status === "aborted" || status === "error") return status
  return "idle"
}

export function derivePendingInteraction(input: PendingInteractionInput): PendingInteraction | undefined {
  const permission = input.permissions[0]
  if (permission) return { kind: "permission", requestID: permission.id }
  const question = input.questions[0]
  if (question) return { kind: "question", requestID: question.id }
  if (input.status !== "idle") return { kind: "status", status: input.status }
  return undefined
}

export function isProductSessionRunning(status: ProductStatus) {
  return status === "running" || status === "retry"
}
