import assert from "node:assert/strict"
import { test } from "node:test"
import { buildStatusPickerItems } from "./status-picker"

test("keeps failed MCP distinct from disabled MCP", () => {
  const items = buildStatusPickerItems("mcp", [
    { name: "broken", availability: "failed", severity: "error", availableActions: [], diagnostic: { message: "Connection refused", textKey: "error.mcp.connection_failed" } },
    { name: "off", availability: "disabled", severity: "none", availableActions: ["connect"] },
  ], [], [])

  assert.deepEqual(items.map((item) => [item.name, item.value, item.tone]), [
    ["broken", "The MCP server connection failed. See the original error for details.", "red"],
    ["off", "Disabled", "gray"],
  ])
})

test("shows enabled idle LSP as idle rather than disabled", () => {
  const items = buildStatusPickerItems("system", [], [], [])
  assert.equal(items.some((item) => item.name === "LSP" && item.value === "Enabled but idle"), true)
})
