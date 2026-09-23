import type { ProductModelSection } from "./types"

export type ProductTextKey =
  | "model.section.favorites"
  | "model.section.recent"
  | "model.section.configured"
  | "model.section.current"
  | "model.section.free"
  | "model.no_match"
  | "model.fallback.default"
  | "model.fallback.provider"
  | "interaction.permission.title"
  | "interaction.question.pending"
  | "error.provider.auth_failed"
  | "error.provider.request_failed"
  | "error.unknown"

export function productTextKeyForModelSection(kind: ProductModelSection["kind"]): ProductTextKey | undefined {
  if (kind === "favorites") return "model.section.favorites"
  if (kind === "recent") return "model.section.recent"
  if (kind === "configured") return "model.section.configured"
  if (kind === "current") return "model.section.current"
  if (kind === "free") return "model.section.free"
}

export function deriveProductErrorTextKey(code: string | undefined, message: string): ProductTextKey {
  if (code === "ProviderAuthError" || /unauthorized|authentication|api key/i.test(message)) return "error.provider.auth_failed"
  if (code === "APIError") return "error.provider.request_failed"
  return "error.unknown"
}
