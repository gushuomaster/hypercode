import { expect, test } from "bun:test"
import type { McpStatus } from "@opencode-ai/sdk/v2"
import { toProductCapabilityConfig } from "../../src/product/capability-adapter"
import { toProductFormatterSummary } from "../../src/product/formatter-adapter"
import { toProductLspSummary } from "../../src/product/lsp-adapter"
import { toProductMcpStates, toProductMcpSummary } from "../../src/product/mcp-adapter"
import { capabilityCases, toTuiSdkInput, type CapabilityMcpStatus } from "../../../product/test/fixtures/capability-states"

// The fixture lives in Product and cannot depend on the SDK, so narrow it to the SDK shape here.
function toSdkMcpStatus(status: CapabilityMcpStatus): McpStatus {
  if (status.status === "failed" || status.status === "needs_client_registration") return { status: status.status, error: status.error ?? "" }
  if (status.status === "unsupported") throw new Error("the SDK McpStatus has no unsupported variant")
  return { status: status.status }
}

// Same table the VS Code parity test iterates: raw facts in, identical Product result out.
for (const item of capabilityCases) {
  test(`TUI adapters match the shared Product result for: ${item.name}`, () => {
    const input = toTuiSdkInput(item)
    const config = toProductCapabilityConfig(input.config ?? {}, input.config !== undefined)
    const mcp = Object.fromEntries(Object.entries(input.mcp).map(([name, status]): [string, McpStatus] => [name, toSdkMcpStatus(status)]))

    expect(toProductMcpSummary({ config, statuses: mcp })).toMatchObject(item.expected.mcp)
    expect(toProductLspSummary({ config, statuses: input.lsp })).toMatchObject(item.expected.lsp)
    expect(toProductFormatterSummary({ config, statuses: input.formatter })).toMatchObject(item.expected.formatter)
    expect(Object.fromEntries(toProductMcpStates(mcp).map((state): [string, string] => [state.name, state.textKey]))).toEqual(item.expected.mcpItems)
  })
}
