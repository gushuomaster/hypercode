import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveProductFormatterSummary, deriveProductLspSummary, deriveProductMcpState, deriveProductMcpSummary, type ProductCapabilityConfigInput } from "@opencode-ai/product"
import { t } from "../../../i18n"
import { toVsCodeTextKey } from "../lib/product-text-adapter"
import { buildStatusPickerItems } from "./status-picker"

const summaries = (config: ProductCapabilityConfigInput) => ({
  mcp: deriveProductMcpSummary({ config, states: [] }),
  lsp: deriveProductLspSummary({ config, states: [] }),
  formatter: deriveProductFormatterSummary({ config, states: [] }),
})
const ready: ProductCapabilityConfigInput = { mcp: [{ name: "docs", enabled: true }], lsp: true, formatter: true }

test("keeps failed MCP distinct from disabled MCP", () => {
  const items = buildStatusPickerItems("mcp", [
    deriveProductMcpState({ name: "broken", status: { status: "failed", error: "Connection refused" } }),
    deriveProductMcpState({ name: "off", status: { status: "disabled" } }),
  ], [], [], summaries(ready))

  assert.deepEqual(items.map((item) => [item.name, item.value, item.tone]), [
    ["broken", "The MCP server connection failed. See the original error for details.", "red"],
    ["off", "Disabled", "gray"],
  ])
})

test("client registration is shown as its own error instead of a generic failure", () => {
  const [registration] = buildStatusPickerItems("mcp", [
    deriveProductMcpState({ name: "docs", status: { status: "needs_client_registration", error: "register client" } }),
  ], [], [], summaries(ready))
  const [failed] = buildStatusPickerItems("mcp", [
    deriveProductMcpState({ name: "docs", status: { status: "failed", error: "timeout" } }),
  ], [], [], summaries(ready))

  assert.equal(registration.tone, "red")
  assert.notEqual(registration.value, failed.value)
})

test("a running reconnect is shown as connecting, not as the old failure", () => {
  const [item] = buildStatusPickerItems("mcp", [
    deriveProductMcpState({ name: "broken", status: { status: "failed", error: "Connection refused" }, pending: "reconnect" }),
  ], [], [], summaries(ready))

  assert.equal(item.value, t(toVsCodeTextKey("item.mcp.connecting")))
  assert.equal(item.tone, "gray")
  assert.equal(item.action, undefined)
})

test("zero configured MCP servers is reported as unconfigured, not disabled", () => {
  const items = buildStatusPickerItems("system", [], [], [], summaries({ mcp: [], lsp: true, formatter: true }))
  assert.equal(items.find((item) => item.name === "MCP")?.value, t(toVsCodeTextKey("status.mcp.unconfigured")))
})

test("configuration that has not loaded is reported as unknown for every capability", () => {
  const items = buildStatusPickerItems("system", [], [], [], summaries({}))
  for (const name of ["MCP", "LSP", "Formatter"]) {
    assert.equal(items.find((item) => item.name === name)?.value, t(toVsCodeTextKey(`status.${name.toLowerCase()}.unknown` as "status.mcp.unknown")), name)
  }
})

test("shows enabled idle LSP as idle rather than disabled", () => {
  const items = buildStatusPickerItems("system", [], [], [], summaries({ mcp: [], lsp: true, formatter: true }))
  assert.equal(items.some((item) => item.name === "LSP" && item.value === "LSP is enabled but idle."), true)
})

test("shows explicitly disabled LSP and idle MCP from Product summaries", () => {
  const items = buildStatusPickerItems("system", [], [], [], summaries({ mcp: [{ name: "docs", enabled: true }], lsp: false, formatter: false }))
  assert.equal(items.find((item) => item.name === "LSP")?.value, "LSP is disabled.")
  assert.equal(items.find((item) => item.name === "MCP")?.value, "MCP is enabled but idle.")
})
