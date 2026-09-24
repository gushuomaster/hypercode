import assert from "node:assert/strict"
import { test } from "node:test"
import { productActionFixtures, productSelectionActionFixtures } from "../../../../../../packages/product/test/fixtures/product-actions"
import { toVsCodeProductAction, toVsCodeProductSelection } from "./product-action-adapter"

test("keeps provider recovery intents as Product actions", () => {
  expect(toVsCodeProductAction({ type: "provider.authenticate", providerID: "openai" })).toEqual({
    kind: "provider",
    action: { type: "provider.authenticate", providerID: "openai" },
  })
})

test("maps MCP actions to the existing host bridge", () => {
  assert.deepEqual(toVsCodeProductAction({ type: "mcp.authenticate", name: "docs" }), {
    kind: "mcp",
    action: { type: "mcp.authenticate", name: "docs" },
  })
})

test("maps shared product actions to existing VSCode host messages", () => {
  const options = {
    sessions: [
      { id: "session-2", available: true },
      { id: "session-3", available: true },
    ],
  }
  assert.deepEqual(productActionFixtures.map((action) => toVsCodeProductAction(action, options)), [
    {
      kind: "host",
      message: {
        type: "submit",
        text: "hello",
        agent: "build",
        model: { providerID: "openai", modelID: "gpt-5" },
        variant: "fast",
      },
    },
    { kind: "host", message: { type: "composerAction", action: "interruptSession" } },
    { kind: "unavailable", action: "session.retry" },
    {
      kind: "host",
      message: {
        type: "composerAction",
        action: "compactSession",
        model: { providerID: "openai", modelID: "gpt-5" },
      },
    },
    { kind: "host", message: { type: "composerAction", action: "undoSession" } },
    { kind: "host", message: { type: "composerAction", action: "redoSession" } },
    { kind: "host", message: { type: "switchSessionInPlace", sessionID: "session-2" } },
    { kind: "host", message: { type: "switchSessionInPlace", sessionID: "session-3" } },
    { kind: "selection", action: productActionFixtures[8] },
    { kind: "selection", action: productActionFixtures[9] },
    { kind: "selection", action: productActionFixtures[10] },
    { kind: "host", message: { type: "permissionReply", requestID: "permission-1", reply: "once" } },
    { kind: "host", message: { type: "questionReply", requestID: "question-1", answers: [["yes"]] } },
    { kind: "host", message: { type: "questionReject", requestID: "question-1" } },
  ])
})

test("accepts shared selection actions without host messages", () => {
  assert.deepEqual(productSelectionActionFixtures.map((action) => toVsCodeProductSelection(action)), [
    { type: "model.select", model: { providerID: "openai", modelID: "gpt-5" } },
    { type: "agent.select", agent: "plan" },
    { type: "variant.select", model: { providerID: "openai", modelID: "gpt-5" }, variant: "deep" },
  ])
})

test("validates session switch targets against the shared session projection", () => {
  const options = {
    currentSessionID: "session-1",
    sessions: [
      { id: "session-1", available: true },
      { id: "session-2", available: true },
      { id: "session-offline", available: false },
    ],
  }

  assert.deepEqual(toVsCodeProductAction({ type: "session.switch", sessionID: "session-1" }, options), { kind: "none" })
  assert.deepEqual(toVsCodeProductAction({ type: "session.switch", sessionID: "missing" }, options), { kind: "none" })
  assert.deepEqual(toVsCodeProductAction({ type: "session.switch", sessionID: "session-offline" }, options), { kind: "none" })
  assert.deepEqual(toVsCodeProductAction({ type: "session.switch", sessionID: "session-2" }, options), {
    kind: "host",
    message: { type: "switchSessionInPlace", sessionID: "session-2" },
  })
})

test("keeps session mutations as shared Product intents", () => {
  const actions = [
    { type: "session.rename", sessionID: "session-a", title: "Renamed" },
    { type: "session.archive", sessionID: "session-a" },
    { type: "session.share", sessionID: "session-a" },
    { type: "session.unshare", sessionID: "session-a" },
    { type: "session.tag.add", sessionID: "session-a", tag: "ops" },
    { type: "session.tag.remove", sessionID: "session-a", tag: "docs" },
  ] as const

  assert.deepEqual(actions.map((action) => toVsCodeProductAction(action)), actions.map((action) => ({
    kind: "mutation",
    action,
  })))
})
