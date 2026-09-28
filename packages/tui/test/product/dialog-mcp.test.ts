import { expect, test } from "bun:test"
import { mcpStatusLabel } from "../../src/component/dialog-mcp"

test("does not label failed MCP state as disabled", () => {
  expect(mcpStatusLabel({ name: "broken", availability: "failed", severity: "error", availableActions: ["reconnect"] })).toBe("dialog.mcp.failed")
  expect(mcpStatusLabel({ name: "off", availability: "disabled", severity: "none", availableActions: ["connect"] })).toBe("dialog.mcp.disabled")
})
