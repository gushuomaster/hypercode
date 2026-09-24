export type ProductContextUsage =
  | { availability: "known"; percent: number }
  | { availability: "unknown" }

export function deriveProductContextUsage(tokens: number, limit?: number): ProductContextUsage {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) return { availability: "unknown" }
  return { availability: "known", percent: Math.round(Math.max(0, tokens) / limit * 100) }
}
