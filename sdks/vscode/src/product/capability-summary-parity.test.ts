import assert from "node:assert/strict"
import { test } from "node:test"
import { toProductFormatterStates, toProductFormatterSummary } from "./formatter-adapter"
import { toProductLspStates, toProductLspSummary } from "./lsp-adapter"
import { toProductMcpStates, toProductMcpSummary } from "./mcp-adapter"
import { capabilityCases, toVsCodeSnapshotInput } from "../../../../packages/product/test/fixtures/capability-states"

// Same table the TUI parity test iterates: raw facts in, identical Product result out.
for (const item of capabilityCases) {
  test(`VS Code adapters match the shared Product result for: ${item.name}`, () => {
    const input = toVsCodeSnapshotInput(item)
    const config = input.capabilityConfig ?? {}
    const mcp = input.mcp as Parameters<typeof toProductMcpSummary>[0]["statuses"]

    assert.partialDeepStrictEqual(toProductMcpSummary({ config, statuses: mcp }), item.expected.mcp)
    assert.partialDeepStrictEqual(toProductLspSummary({ config, statuses: input.lsp }), item.expected.lsp)
    assert.partialDeepStrictEqual(toProductFormatterSummary({ config, statuses: input.formatter }), item.expected.formatter)
    assert.deepEqual(Object.fromEntries(toProductMcpStates(mcp).map((state) => [state.name, state.textKey])), item.expected.mcpItems)
    assert.equal(toProductLspStates(input.lsp).every((state) => state.textKey.startsWith("item.lsp.")), true)
    assert.equal(toProductFormatterStates(input.formatter).every((state) => state.textKey.startsWith("item.formatter.")), true)
  })
}
