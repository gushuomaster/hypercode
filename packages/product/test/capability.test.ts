import { expect, test } from "bun:test"
import { deriveProductFormatterSummary, deriveProductLspSummary, deriveProductMcpSummary } from "../src/capability"

test("derives enabled-but-empty LSP as idle instead of disabled", () => {
  expect(deriveProductLspSummary({ config: { lsp: true }, states: [] })).toMatchObject({
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
    config: { mcp: [{ name: "docs", enabled: true }, { name: "broken", enabled: true }] },
    states: [
      { name: "docs", availability: "connected", severity: "none", availableActions: [], textKey: "item.mcp.connected" },
      { name: "broken", availability: "failed", severity: "error", availableActions: [], textKey: "item.mcp.failed" },
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
  expect(deriveProductFormatterSummary({ config: { formatter: false }, states: [] })).toMatchObject({
    availability: "disabled",
    severity: "none",
    configuredCount: 0,
    activeCount: 0,
    failedCount: 0,
    textKey: "status.formatter.disabled",
  })
})

test("derives zero configured MCP servers as unconfigured instead of disabled", () => {
  expect(deriveProductMcpSummary({ config: { mcp: [] }, states: [] })).toMatchObject({
    availability: "unconfigured",
    severity: "none",
    textKey: "status.mcp.unconfigured",
  })
})

test("derives MCP servers that are all turned off as disabled", () => {
  expect(deriveProductMcpSummary({
    config: { mcp: [{ name: "docs", enabled: false }, { name: "search", enabled: false }] },
    states: [],
  })).toMatchObject({ availability: "disabled", textKey: "status.mcp.disabled" })
})

test("derives enabled-but-empty MCP configuration as idle", () => {
  expect(deriveProductMcpSummary({ config: { mcp: [{ name: "docs", enabled: true }] }, states: [] })).toMatchObject({
    availability: "idle",
    textKey: "status.mcp.idle",
  })
})

test("derives missing configuration facts as unknown for every capability", () => {
  expect(deriveProductMcpSummary({ config: {}, states: [] })).toMatchObject({ availability: "unknown", textKey: "status.mcp.unknown" })
  expect(deriveProductLspSummary({ config: {}, states: [] })).toMatchObject({ availability: "unknown", textKey: "status.lsp.unknown" })
  expect(deriveProductFormatterSummary({ config: {}, states: [] })).toMatchObject({ availability: "unknown", textKey: "status.formatter.unknown" })
})

test("unknown never depends on how many states a host happens to hold", () => {
  expect(deriveProductLspSummary({
    config: {},
    states: [{ id: "ts", name: "typescript", root: "/repo", availability: "connected", severity: "none", textKey: "item.lsp.connected" }],
  })).toMatchObject({ availability: "unknown" })
})
