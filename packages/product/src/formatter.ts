export type ProductFormatterState = {
  name: string
  enabled: boolean
  extensions: string[]
  severity: "none" | "warning"
}

export type ProductFormatterStateInput = {
  name: string
  enabled: boolean
  extensions?: string[]
}

export function deriveProductFormatterState(input: ProductFormatterStateInput): ProductFormatterState {
  const extensions = [...new Set((input.extensions ?? []).map((extension) => extension.trim()).filter(Boolean))].sort()
  return {
    name: input.name,
    enabled: input.enabled,
    extensions,
    severity: input.enabled ? "none" : "warning",
  }
}

export function deriveProductFormatterStates(inputs: ProductFormatterStateInput[]): ProductFormatterState[] {
  return inputs.map(deriveProductFormatterState).sort((left, right) => left.name.localeCompare(right.name))
}
