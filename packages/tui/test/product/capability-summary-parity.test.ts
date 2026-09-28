import { expect, test } from "bun:test"
import { toProductLspSummary } from "../../src/product/lsp-adapter"
import { toProductMcpSummary } from "../../src/product/mcp-adapter"

test("TUI adapters use shared Product summary semantics", () => {
  expect(toProductLspSummary({ configured: true, statuses: [] })).toMatchObject({ availability: "idle", textKey: "status.lsp.idle" })
  expect(toProductMcpSummary({ configured: true, statuses: { broken: { status: "failed", error: "refused" } } })).toMatchObject({ availability: "failed", severity: "error" })
})
