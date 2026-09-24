import assert from "node:assert/strict"
import { test } from "node:test"
import { toProductMcpStates } from "./mcp-adapter"

test("VS Code MCP product adapter keeps shared severity and host actions", () => {
  const states = toProductMcpStates({
    docs: { status: "needs_auth" },
    local: { status: "connected" },
    broken: { status: "failed", error: "connection refused" },
  })

  assert.deepEqual(states.map((state) => ({ name: state.name, severity: state.severity, action: state.action })), [
    { name: "broken", severity: "error", action: "reconnect" },
    { name: "docs", severity: "warning", action: "authenticate" },
    { name: "local", severity: "none", action: "disconnect" },
  ])
})
