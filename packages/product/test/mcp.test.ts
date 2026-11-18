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

  test("selects the per-entry text key from availability so hosts do not", () => {
    const states = deriveProductMcpStates(mcpStateFixture)

    expect(states.map((state) => [state.name, state.textKey])).toEqual([
      ["disabled", "item.mcp.disabled"],
      ["docs", "item.mcp.needs_auth"],
      ["local", "item.mcp.connected"],
      ["registration", "item.mcp.needs_client_registration"],
      ["zeta", "item.mcp.failed"],
    ])
    expect(deriveProductMcpState({ name: "x", status: { status: "unsupported" } }).textKey).toBe("item.mcp.unsupported")
  })

  test("models a running connect as connecting and hides conflicting actions", () => {
    const state = deriveProductMcpState({ name: "docs", status: { status: "disabled" }, pending: "connect" })

    expect(state).toEqual({
      name: "docs",
      availability: "connecting",
      severity: "none",
      pending: "connect",
      availableActions: [],
      textKey: "item.mcp.connecting",
    })
    expect(deriveProductMcpAction(state)).toBeUndefined()
  })

  test("a reconnect of a failed server is not reported as failed while it runs", () => {
    const state = deriveProductMcpState({
      name: "broken",
      status: { status: "failed", error: "Connection refused", raw: "MCPFailed: broken" },
      pending: "reconnect",
    })

    expect(state.availability).toBe("connecting")
    expect(state.severity).toBe("none")
    expect(state.availableActions).toEqual([])
    expect(state.diagnostic).toBeUndefined()
  })

  test("a running disconnect keeps the current availability but offers no actions", () => {
    const state = deriveProductMcpState({ name: "local", status: { status: "connected" }, pending: "disconnect" })

    expect(state.availability).toBe("connected")
    expect(state.pending).toBe("disconnect")
    expect(state.textKey).toBe("item.mcp.disconnecting")
    expect(state.availableActions).toEqual([])
    expect(state.action).toBeUndefined()
  })

  test("a status already reported as connecting offers no actions even without a pending fact", () => {
    const state = deriveProductMcpState({ name: "docs", status: { status: "connecting" } })

    expect(state.severity).toBe("none")
    expect(state.availableActions).toEqual([])
    expect(state.textKey).toBe("item.mcp.connecting")
  })
})
