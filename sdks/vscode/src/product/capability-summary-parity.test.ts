import assert from "node:assert/strict"
import { test } from "node:test"
import { toProductLspSummary } from "./lsp-adapter"
import { toProductMcpSummary } from "./mcp-adapter"

test("VS Code adapters use shared Product summary semantics", () => {
  assert.deepEqual(toProductLspSummary({ configured: true, statuses: [] }), {
    availability: "idle", severity: "none", configuredCount: 1, activeCount: 0, failedCount: 0, textKey: "status.lsp.idle",
  })
  assert.equal(toProductMcpSummary({ configured: true, statuses: { broken: { status: "failed", error: "refused" } } }).availability, "failed")
})
