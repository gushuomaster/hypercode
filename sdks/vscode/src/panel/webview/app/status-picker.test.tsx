import assert from "node:assert/strict"
import { test } from "node:test"
import { buildStatusPickerItems } from "./status-picker"
import { deriveProductFormatterSummary, deriveProductLspSummary, deriveProductMcpSummary } from "@opencode-ai/product"

test("keeps failed MCP distinct from disabled MCP", () => {
  const items = buildStatusPickerItems("mcp", [
    { name: "broken", availability: "failed", severity: "error", availableActions: [], diagnostic: { message: "Connection refused", textKey: "error.mcp.connection_failed" } },
    { name: "off", availability: "disabled", severity: "none", availableActions: ["connect"] },
  ], [], [], {
    mcp: deriveProductMcpSummary({ configured: true, states: [] }),
    lsp: deriveProductLspSummary({ configured: true, states: [] }),
    formatter: deriveProductFormatterSummary({ configured: true, states: [] }),
  })

  assert.deepEqual(items.map((item) => [item.name, item.value, item.tone]), [
    ["broken", "The MCP server connection failed. See the original error for details.", "red"],
    ["off", "Disabled", "gray"],
  ])
})

test("shows enabled idle LSP as idle rather than disabled", () => {
  const items = buildStatusPickerItems("system", [], [], [], {
    mcp: deriveProductMcpSummary({ configured: false, states: [] }),
    lsp: deriveProductLspSummary({ configured: true, states: [] }),
    formatter: deriveProductFormatterSummary({ configured: true, states: [] }),
  })
  assert.equal(items.some((item) => item.name === "LSP" && item.value === "LSP is enabled but idle."), true)
})

test("shows explicitly disabled LSP and idle MCP from Product summaries", () => {
  const items = buildStatusPickerItems("system", [], [], [], {
    mcp: deriveProductMcpSummary({ configured: true, states: [] }),
    lsp: deriveProductLspSummary({ configured: false, states: [] }),
    formatter: deriveProductFormatterSummary({ configured: false, states: [] }),
  })
  assert.equal(items.find((item) => item.name === "LSP")?.value, "LSP is disabled.")
  assert.equal(items.find((item) => item.name === "MCP")?.value, "MCP is enabled but idle.")
})
