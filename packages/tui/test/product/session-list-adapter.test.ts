import { expect, test } from "bun:test"
import { deriveProductSessionList } from "@opencode-ai/product"
import { paritySessionLifecycleInput, paritySessionLifecycleStatuses, paritySessionStatuses, paritySessionTags, parityTuiSessionListInput } from "../../../product/test/fixtures/session-list"
import { toTuiProductSessionInput } from "../../src/product/session-list-adapter"

test("projects the shared session list fixture from TUI state", () => {
  const list = deriveProductSessionList({
    sessions: parityTuiSessionListInput.map((session) => toTuiProductSessionInput(
      session,
      paritySessionStatuses[session.id as keyof typeof paritySessionStatuses],
      paritySessionTags[session.id as keyof typeof paritySessionTags],
    )),
    activeSessionID: "session-b",
  })

  expect(list.items.map((session) => ({ id: session.id, title: session.title, status: session.status, active: session.active }))).toEqual([
    { id: "session-a", title: "Alpha", status: "running", active: false },
    { id: "session-b", title: "session-", status: "idle", active: true },
  ])
})

test("projects shared session lifecycle states from TUI state", () => {
  const list = deriveProductSessionList({
    sessions: paritySessionLifecycleInput.map((session) => toTuiProductSessionInput(
      session,
      paritySessionLifecycleStatuses[session.id as keyof typeof paritySessionLifecycleStatuses],
    )),
  })

  expect(list.items.map((session) => [session.id, session.status])).toEqual([
    ["session-running", "running"],
    ["session-retry", "retry"],
    ["session-error", "error"],
    ["session-aborted", "aborted"],
  ])
})
