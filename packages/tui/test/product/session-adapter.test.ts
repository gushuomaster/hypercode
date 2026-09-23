import { expect, test } from "bun:test"
import { createProductSnapshot } from "@opencode-ai/product"
import { reduceTuiProductEvent, toProductEvent, toProductSnapshot } from "../../src/product/session-adapter"
import { parityProductSnapshot, parityTuiSessionInput, rawSessionLifecycleEvents, sessionLifecycleEvents } from "../../../product/test/fixtures/session-events"

test("projects the shared parity fixture from TUI state", () => {
  expect(toProductSnapshot(parityTuiSessionInput)).toEqual(parityProductSnapshot)
})

test("projects the shared host event fixture from TUI", () => {
  expect(rawSessionLifecycleEvents.map(toProductEvent)).toEqual(sessionLifecycleEvents)
})

test("maintains the canonical TUI product snapshot from host events", () => {
  expect(rawSessionLifecycleEvents.reduce(reduceTuiProductEvent, createProductSnapshot())).toMatchObject({
    status: "idle",
    tools: [{ id: "part-tool", status: "completed" }],
    resolved: {
      permissions: ["permission-1"],
      questions: ["question-1"],
    },
  })
})
