import { describe, expect, test } from "bun:test"
import { deriveProductMcpAction, deriveProductMcpState, deriveProductMcpStates } from "../src/mcp"
import { mcpStateFixture } from "./fixtures/mcp-states"

describe("MCP product state", () => {
  test("projects shared MCP statuses with severity and recovery actions", () => {
    const states = deriveProductMcpStates(mcpStateFixture)

    expect(states.map((state) => [state.name, state.severity, state.action])).toEqual([
      ["disabled", "none", "connect"],
      ["docs", "warning", "authenticate"],
      ["local", "none", "disconnect"],
      ["registration", "error", "reconnect"],
      ["zeta", "error", "reconnect"],
    ])
  })

  test("preserves raw MCP diagnostics while adding semantic text keys", () => {
    const state = deriveProductMcpState({
      name: "broken",
      status: { status: "failed", error: "Connection refused", raw: "MCPFailed: broken" },
    })

    expect(state.diagnostic).toEqual({
      message: "Connection refused",
      raw: "MCPFailed: broken",
      textKey: "error.mcp.connection_failed",
    })
  })

  test("does not invent an action for unsupported MCP servers", () => {
    const state = deriveProductMcpState({ name: "unsupported", status: { status: "unsupported", error: "not available" } })

    expect(state.severity).toBe("error")
    expect(state.action).toBeUndefined()
    expect(state.availableActions).toEqual([])
    expect(deriveProductMcpAction(state)).toBeUndefined()
  })

  test("derives host-neutral MCP actions", () => {
    const state = deriveProductMcpState({ name: "docs", status: { status: "needs_auth" } })

    expect(deriveProductMcpAction(state)).toEqual({ type: "mcp.authenticate", name: "docs" })
  })
})
