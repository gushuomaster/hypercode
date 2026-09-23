import { expect, test } from "bun:test"
import { productActionFixtures, productSelectionActionFixtures } from "../../../product/test/fixtures/product-actions"
import { toTuiProductAction, toTuiProductSelection } from "../../src/product/action-adapter"

test("maps shared product actions to TUI SDK intents", () => {
  const context = {
    sessionID: "session-1",
    directory: "/workspace",
    workspace: "workspace-1",
    sessions: [
      { id: "session-2", available: true },
      { id: "session-3", available: true },
    ],
  }
  expect(productActionFixtures.map((action) => toTuiProductAction(action, context))).toEqual([
    {
      kind: "session.prompt",
      input: {
        sessionID: "session-1",
        text: "hello",
        agent: "build",
        model: { providerID: "openai", modelID: "gpt-5" },
        variant: "fast",
      },
    },
    { kind: "session.abort", input: { sessionID: "session-1" } },
    { kind: "unavailable", action: "session.retry" },
    {
      kind: "session.summarize",
      input: { sessionID: "session-1", providerID: "openai", modelID: "gpt-5" },
    },
    { kind: "session.revert", input: { sessionID: "session-1" } },
    { kind: "session.unrevert", input: { sessionID: "session-1" } },
    { kind: "session.switch", input: { sessionID: "session-2" } },
    { kind: "session.switch", input: { sessionID: "session-3" } },
    { kind: "selection", action: { type: "model.select", model: { providerID: "openai", modelID: "gpt-5" } } },
    { kind: "selection", action: { type: "agent.select", agent: "plan" } },
    { kind: "selection", action: { type: "variant.select", model: { providerID: "openai", modelID: "gpt-5" }, variant: "deep" } },
    {
      kind: "permission.reply",
      input: { requestID: "permission-1", reply: "once", directory: "/workspace", workspace: "workspace-1" },
    },
    {
      kind: "question.reply",
      input: { requestID: "question-1", answers: [["yes"]], directory: "/workspace" },
    },
    {
      kind: "question.reject",
      input: { requestID: "question-1", directory: "/workspace" },
    },
  ])
})

test("accepts shared selection actions without session context", () => {
  expect(productSelectionActionFixtures.map((action) => toTuiProductSelection(action))).toEqual([
    { type: "model.select", model: { providerID: "openai", modelID: "gpt-5" } },
    { type: "agent.select", agent: "plan" },
    { type: "variant.select", model: { providerID: "openai", modelID: "gpt-5" }, variant: "deep" },
  ])
})

test("validates session switch targets against the shared session projection", () => {
  const context = {
    sessionID: "session-1",
    sessions: [
      { id: "session-1", available: true },
      { id: "session-2", available: true },
      { id: "session-offline", available: false },
    ],
  }

  expect(toTuiProductAction({ type: "session.switch", sessionID: "session-1" }, context)).toEqual({ kind: "none" })
  expect(toTuiProductAction({ type: "session.switch", sessionID: "missing" }, context)).toEqual({ kind: "none" })
  expect(toTuiProductAction({ type: "session.switch", sessionID: "session-offline" }, context)).toEqual({ kind: "none" })
  expect(toTuiProductAction({ type: "session.switch", sessionID: "session-2" }, context)).toEqual({
    kind: "session.switch",
    input: { sessionID: "session-2" },
  })
})

test("keeps session mutation actions as shared Product intents", () => {
  const action = { type: "session.rename", sessionID: "session-1", title: "Renamed" } as const
  expect(toTuiProductAction(action, { sessionID: "session-1" })).toEqual({
    kind: "session.mutation",
    action,
  })
})
