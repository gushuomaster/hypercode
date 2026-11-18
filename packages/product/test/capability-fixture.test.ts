import { describe, expect, test } from "bun:test"
import { deriveProductFormatterSummary, deriveProductLspSummary, deriveProductMcpSummary } from "../src/capability"
import { deriveProductFormatterStates } from "../src/formatter"
import { deriveProductLspStates } from "../src/lsp"
import { deriveProductMcpStates } from "../src/mcp"
import { capabilityCases } from "./fixtures/capability-states"

describe("shared capability fixture", () => {
  test("covers every summary availability a host can show", () => {
    const seen = new Set(capabilityCases.flatMap((item) => [item.expected.mcp, item.expected.lsp, item.expected.formatter].map((summary) => summary.availability)))
    for (const availability of ["unconfigured", "unknown", "disabled", "idle", "healthy", "needs_attention", "degraded", "failed"]) {
      expect(seen.has(availability)).toBe(true)
    }
  })

  for (const item of capabilityCases) {
    test(`Product derives the expected result for: ${item.name}`, () => {
      const mcpStates = deriveProductMcpStates(Object.entries(item.mcp).map(([name, status]) => ({ name, status })))
      const lspStates = deriveProductLspStates(item.lsp)
      const formatterStates = deriveProductFormatterStates(item.formatter)

      expect(deriveProductMcpSummary({ config: item.config, states: mcpStates })).toMatchObject(item.expected.mcp)
      expect(deriveProductLspSummary({ config: item.config, states: lspStates })).toMatchObject(item.expected.lsp)
      expect(deriveProductFormatterSummary({ config: item.config, states: formatterStates })).toMatchObject(item.expected.formatter)
      expect(Object.fromEntries(mcpStates.map((state): [string, string] => [state.name, state.textKey]))).toEqual(item.expected.mcpItems)
    })
  }
})
