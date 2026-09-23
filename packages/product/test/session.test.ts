import { describe, expect, test } from "bun:test"
import {
  activateProductSession,
  beginProductSessionSwitch,
  createProductSessionState,
  createProductSnapshot,
  deriveProductSessionList,
  deriveProductSessionSwitch,
  mergePartialProductSnapshot,
  rememberProductSessionSnapshot,
} from "../src"
import { paritySessionLifecycleInput, paritySessionLifecycleStatuses, productSessionInputs } from "./fixtures/session-list"

describe("deriveProductSessionList", () => {
  test("owns root filtering, deduplication, recency ordering, title fallback, and active selection", () => {
    const result = deriveProductSessionList({
      sessions: [...productSessionInputs, { ...productSessionInputs[1]!, updatedAt: 25 }],
      activeSessionID: "session-b",
      selectedSessionID: "missing",
    })

    expect(result.status).toBe("ready")
    expect(result.items.map((item) => ({ id: item.id, title: item.title, status: item.status, active: item.active }))).toEqual([
      { id: "session-a", title: "Alpha", status: "running", active: false },
      { id: "session-b", title: "session-", status: "idle", active: true },
    ])
    expect(result.selectedSessionID).toBe("session-b")
    expect(result.availableTags).toEqual(["docs", "ops", "urgent"])
  })

  test("filters by title, id, and tags and falls back to the first available session", () => {
    expect(deriveProductSessionList({ sessions: productSessionInputs, query: "urgent" }).items.map((item) => item.id)).toEqual(["session-a"])
    expect(deriveProductSessionList({ sessions: productSessionInputs, query: "session-b" }).items.map((item) => item.id)).toEqual(["session-b"])
    expect(deriveProductSessionList({ sessions: productSessionInputs, selectedSessionID: "missing" }).selectedSessionID).toBe("session-a")
  })

  test("defines loading, empty, error, and switching states", () => {
    expect(deriveProductSessionList({ sessions: [], loading: true }).status).toBe("loading")
    expect(deriveProductSessionList({ sessions: [] }).status).toBe("empty")
    expect(deriveProductSessionList({ sessions: [], error: { message: "failed" } })).toMatchObject({ status: "error", error: { message: "failed" } })
    expect(deriveProductSessionList({ sessions: productSessionInputs, activeSessionID: "session-a", switchingSessionID: "session-b" }).switchingSessionID).toBe("session-b")
  })

  test("projects running, retry, error, and aborted lifecycle states", () => {
    const result = deriveProductSessionList({
      sessions: paritySessionLifecycleInput.map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.time.updated,
        status: paritySessionLifecycleStatuses[session.id as keyof typeof paritySessionLifecycleStatuses].type,
      })),
    })

    expect(result.items.map((session) => [session.id, session.status])).toEqual([
      ["session-running", "running"],
      ["session-retry", "retry"],
      ["session-error", "error"],
      ["session-aborted", "aborted"],
    ])
  })
})

test("deriveProductSessionSwitch rejects the active, missing, and unavailable targets", () => {
  const sessions = deriveProductSessionList({
    sessions: [...productSessionInputs, { id: "session-offline", updatedAt: 10, available: false }],
    activeSessionID: "session-a",
  }).items

  expect(deriveProductSessionSwitch({ sessions, currentSessionID: "session-a", targetSessionID: "session-a" })).toBeUndefined()
  expect(deriveProductSessionSwitch({ sessions, currentSessionID: "session-a", targetSessionID: "missing" })).toBeUndefined()
  expect(deriveProductSessionSwitch({ sessions, currentSessionID: "session-a", targetSessionID: "session-offline" })).toBeUndefined()
  expect(deriveProductSessionSwitch({ sessions, currentSessionID: "session-a", targetSessionID: "session-b" })).toEqual({ sessionID: "session-b" })
})

test("mergePartialProductSnapshot keeps lifecycle and interactions while replacing transcript state", () => {
  const current = createProductSnapshot({
    status: "error",
    permissions: [{ id: "permission-a", sessionID: "session-a" }],
    questions: [{ id: "question-a", sessionID: "session-a" }],
    error: { message: "failed", raw: "HTTP 500" },
  })
  const next = mergePartialProductSnapshot(current, createProductSnapshot({
    messages: [{ id: "message-new", sessionID: "session-a", parts: [] }],
  }), {
    status: false,
    permissions: false,
    questions: false,
  })

  expect(next).toMatchObject({
    status: "error",
    messages: [{ id: "message-new" }],
    permissions: [{ id: "permission-a" }],
    questions: [{ id: "question-a" }],
    error: { raw: "HTTP 500" },
  })
})

test("Product session state isolates A and B and restores A after A to B to A", () => {
  const sessionA = createProductSnapshot({
    status: "running",
    permissions: [{ id: "permission-a", sessionID: "session-a" }],
    tools: [{ id: "tool-a", messageID: "message-a", name: "bash", status: "running" }],
    resolved: { permissions: [], questions: ["question-a"] },
  })
  const sessionB = createProductSnapshot({ status: "idle" })
  const withA = rememberProductSessionSnapshot(createProductSessionState("session-a"), "session-a", sessionA)
  const switchingToB = beginProductSessionSwitch(withA, "session-b")
  const onB = activateProductSession(switchingToB, "session-b", sessionB)
  const backToA = activateProductSession(beginProductSessionSwitch(onB, "session-a"), "session-a")

  expect(onB.snapshots["session-b"]).toEqual(sessionB)
  expect(onB.snapshots["session-b"]?.permissions).toEqual([])
  expect(backToA.snapshots["session-a"]).toEqual(sessionA)
  expect(backToA.activeSessionID).toBe("session-a")
  expect(backToA.switchingSessionID).toBeUndefined()
})
