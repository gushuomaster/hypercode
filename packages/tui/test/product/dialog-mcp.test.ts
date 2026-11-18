import { expect, test } from "bun:test"
import { mcpFailureToast } from "../../src/component/dialog-mcp"
import { translate } from "../../src/context/language"
import { toProductMcpStates } from "../../src/product/mcp-adapter"
import { toTuiTextKey } from "../../src/product/text-adapter"

test("does not label failed MCP state as disabled", () => {
  const states = toProductMcpStates({ broken: { status: "failed", error: "connection refused" }, off: { status: "disabled" } })
  expect(Object.fromEntries(states.map((state) => [state.name, state.textKey]))).toEqual({
    broken: "item.mcp.failed",
    off: "item.mcp.disabled",
  })
  expect(translate(toTuiTextKey("item.mcp.failed"))).not.toBe(translate(toTuiTextKey("item.mcp.disabled")))
})

test("client registration is explained instead of collapsing into a generic failure", () => {
  const [state] = toProductMcpStates({ docs: { status: "needs_client_registration", error: "register client" } })
  expect(state.textKey).toBe("item.mcp.needs_client_registration")
  expect(translate(toTuiTextKey(state.textKey))).not.toBe(translate(toTuiTextKey("item.mcp.failed")))
})

test("a running reconnect is reported by Product as connecting with no actions", () => {
  const [state] = toProductMcpStates({ broken: { status: "failed", error: "connection refused" } }, { broken: "reconnect" })
  expect(state.availability).toBe("connecting")
  expect(state.textKey).toBe("item.mcp.connecting")
  expect(state.availableActions).toEqual([])
  expect(state.action).toBeUndefined()
})

test("toggle failure shows a localized title and keeps the original error", () => {
  const toast = mcpFailureToast("toggle", new Error("connect ECONNREFUSED 127.0.0.1:3000"))
  expect(toast.variant).toBe("error")
  expect(toast.title).toBe(translate("dialog.mcp.toggleFailed"))
  expect(toast.message).toBe("connect ECONNREFUSED 127.0.0.1:3000")
})

test("non-Error failures are still surfaced as text", () => {
  expect(mcpFailureToast("toggle", "timeout").message).toBe("timeout")
})

test("refresh without data explains the failure instead of staying silent", () => {
  const toast = mcpFailureToast("refresh")
  expect(toast.variant).toBe("error")
  expect(toast.title).toBe(translate("dialog.mcp.refreshFailed"))
  expect(toast.message).toBe(translate("dialog.mcp.refreshNoData"))
})

test("toggle failure without detail does not claim the refresh returned no data", () => {
  expect(mcpFailureToast("toggle").message).toBe(translate("dialog.mcp.toggleFailed"))
})
