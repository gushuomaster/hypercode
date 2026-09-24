import type { ProductTextKey } from "./text"

export type ProductLspAvailability = "connected" | "error"

export type ProductLspSeverity = "none" | "error"

export type ProductLspStateInput = {
  id: string
  name: string
  root: string
  status: ProductLspAvailability
  error?: string
  raw?: string
}

export type ProductLspState = {
  id: string
  name: string
  root: string
  availability: ProductLspAvailability
  severity: ProductLspSeverity
  diagnostic?: {
    message: string
    raw?: string
    textKey: Extract<ProductTextKey, `error.lsp.${string}`>
  }
}

export function deriveProductLspState(input: ProductLspStateInput): ProductLspState {
  return {
    id: input.id,
    name: input.name,
    root: input.root,
    availability: input.status,
    severity: input.status === "error" ? "error" : "none",
    ...(input.status === "error"
      ? {
          diagnostic: {
            message: input.error ?? "LSP connection failed",
            ...(input.raw ? { raw: input.raw } : {}),
            textKey: "error.lsp.connection_failed" as const,
          },
        }
      : {}),
  }
}

export function deriveProductLspStates(inputs: ProductLspStateInput[]): ProductLspState[] {
  return inputs.map(deriveProductLspState).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
}
