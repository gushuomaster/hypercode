import { describe, expect, test } from "bun:test"
import { toProductMcpStates } from "../../src/product/mcp-adapter"

describe("TUI MCP product adapter", () => {
  test("projects MCP semantics while exposing only existing TUI host actions", () => {
    const states = toProductMcpStates({
      local: { status: "connected" },
      disabled: { status: "disabled" },
      docs: { status: "needs_auth" },
      broken: { status: "failed", error: "connection refused" },
    })

    expect(states.map((state) => ({
      name: state.name,
      availability: state.availability,
      severity: state.severity,
      action: state.action,
    }))).toEqual([
      { name: "broken", availability: "failed", severity: "error", action: "reconnect" },
      { name: "disabled", availability: "disabled", severity: "none", action: "connect" },
      { name: "docs", availability: "needs_auth", severity: "warning", action: undefined },
      { name: "local", availability: "connected", severity: "none", action: "disconnect" },
    ])
  })
})
