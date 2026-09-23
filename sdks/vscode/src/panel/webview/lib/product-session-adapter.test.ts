import assert from "node:assert/strict"
import { test } from "node:test"
import { parityProductSnapshot, parityVsCodeSessionInput, rawSessionLifecycleEvents, sessionLifecycleEvents } from "../../../../../../packages/product/test/fixtures/session-events"
import { paritySessionLifecycleInput, paritySessionLifecycleStatuses, paritySessionStatuses, paritySessionTags, parityVsCodeSessionListInput } from "../../../../../../packages/product/test/fixtures/session-list"
import { deriveProductSessionList } from "@opencode-ai/product"
import { toProductEvent, toProductSessionInput, toProductSnapshot } from "./product-session-adapter"

test("projects the shared parity fixture from VSCode state", () => {
  assert.deepEqual(toProductSnapshot(parityVsCodeSessionInput), parityProductSnapshot)
})

test("projects the shared host event fixture from VSCode", () => {
  assert.deepEqual(rawSessionLifecycleEvents.map(toProductEvent), sessionLifecycleEvents)
})

test("projects the shared session list fixture from VSCode state", () => {
  const list = deriveProductSessionList({
    sessions: parityVsCodeSessionListInput.map((session) => toProductSessionInput(
      session,
      paritySessionStatuses[session.id as keyof typeof paritySessionStatuses],
      paritySessionTags[session.id as keyof typeof paritySessionTags],
    )),
    activeSessionID: "session-b",
  })

  assert.deepEqual(list.items.map((session) => ({ id: session.id, title: session.title, status: session.status, active: session.active })), [
    { id: "session-a", title: "Alpha", status: "running", active: false },
    { id: "session-b", title: "session-", status: "idle", active: true },
  ])
})

test("projects shared session lifecycle states from VSCode state", () => {
  const list = deriveProductSessionList({
    sessions: paritySessionLifecycleInput.map((session) => toProductSessionInput(
      { ...session, directory: "/workspace" },
      paritySessionLifecycleStatuses[session.id as keyof typeof paritySessionLifecycleStatuses],
    )),
  })

  assert.deepEqual(list.items.map((session) => [session.id, session.status]), [
    ["session-running", "running"],
    ["session-retry", "retry"],
    ["session-error", "error"],
    ["session-aborted", "aborted"],
  ])
})
