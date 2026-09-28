import { expect, test } from "bun:test"
import { deriveProductFormatterSummary, deriveProductLspSummary, deriveProductMcpSummary } from "../src/capability"

test("derives enabled-but-empty LSP as idle instead of disabled", () => {
  expect(deriveProductLspSummary({ configured: true, states: [] })).toMatchObject({
    availability: "idle",
    severity: "none",
    configuredCount: 1,
    activeCount: 0,
    failedCount: 0,
    textKey: "status.lsp.idle",
  })
})

test("derives mixed MCP states as degraded and preserves counts", () => {
  expect(deriveProductMcpSummary({
    configured: true,
    states: [
      { name: "docs", availability: "connected", severity: "none", availableActions: [] },
      { name: "broken", availability: "failed", severity: "error", availableActions: [] },
    ],
  })).toMatchObject({
    availability: "degraded",
    severity: "warning",
    configuredCount: 2,
    activeCount: 1,
    failedCount: 1,
    textKey: "status.mcp.degraded",
  })
})

test("derives disabled formatter configuration without active formatters", () => {
  expect(deriveProductFormatterSummary({ configured: false, states: [] })).toMatchObject({
    availability: "disabled",
    severity: "none",
    configuredCount: 0,
    activeCount: 0,
    failedCount: 0,
    textKey: "status.formatter.disabled",
  })
})
