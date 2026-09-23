import { describe, expect, test } from "bun:test"
import {
  beginProductSessionMutation,
  completeProductSessionMutation,
  createProductSessionMutationState,
  deriveProductSessionMutationAvailability,
  deriveProductSessionMutationStatus,
  failProductSessionMutation,
  hydrateProductMutableSessions,
  normalizeProductSessionMutationError,
  type ProductSessionMutationAction,
} from "../src"
import { mutableSession, supportedSessionMutations, unsupportedSessionMutations } from "./fixtures/session-mutations"

function hydratedSession(overrides: Partial<typeof mutableSession> = {}) {
  return hydrateProductMutableSessions(createProductSessionMutationState(), [{
    ...mutableSession,
    ...overrides,
  }])
}

describe("session mutation availability", () => {
  test("rejects missing, unsupported, repeated, and invalid mutations", () => {
    const state = hydrateProductMutableSessions(createProductSessionMutationState(), [{
      ...mutableSession,
      capabilities: unsupportedSessionMutations,
    }, {
      ...mutableSession,
      id: "session-archived",
      archivedAt: 10,
    }, {
      ...mutableSession,
      id: "session-shared",
      shareURL: "https://example.test/share",
    }])

    expect(deriveProductSessionMutationAvailability(state, { type: "session.rename", sessionID: "missing", title: "Title" })).toEqual({ available: false, reason: "not_found" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.rename", sessionID: "session-a", title: "  " })).toEqual({ available: false, reason: "invalid_title" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.archive", sessionID: "session-a" })).toEqual({ available: false, reason: "unsupported" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.tag.add", sessionID: "session-a", tag: "ops" })).toEqual({ available: false, reason: "unsupported" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.archive", sessionID: "session-archived" })).toEqual({ available: false, reason: "already_archived" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.share", sessionID: "session-shared" })).toEqual({ available: false, reason: "already_shared" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.unshare", sessionID: "session-a" })).toEqual({ available: false, reason: "not_shared" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.tag.add", sessionID: "session-archived", tag: "docs" })).toEqual({ available: false, reason: "duplicate_tag" })
    expect(deriveProductSessionMutationAvailability(state, { type: "session.tag.remove", sessionID: "session-archived", tag: "missing" })).toEqual({ available: false, reason: "missing_tag" })
  })
})

describe("session mutation lifecycle", () => {
  test("marks rename pending without changing canonical state and commits after confirmation", () => {
    const initial = hydratedSession()
    const action: ProductSessionMutationAction = { type: "session.rename", sessionID: "session-a", title: "  Renamed  " }
    const pending = beginProductSessionMutation(initial, action)

    expect(pending.ok).toBe(true)
    if (!pending.ok) throw new Error("expected available mutation")
    expect(pending.intent).toEqual({ type: "session.rename", sessionID: "session-a", title: "Renamed" })
    expect(pending.state.sessions["session-a"]?.title).toBe("Session A")
    expect(deriveProductSessionMutationStatus(pending.state, "session-a", "rename")).toEqual({ state: "pending", action })
    expect(deriveProductSessionMutationAvailability(pending.state, action)).toEqual({ available: false, reason: "pending" })

    const completed = completeProductSessionMutation(pending.state, {
      type: "session.rename",
      sessionID: "session-a",
      title: "  Renamed  ",
    })
    expect(completed.sessions["session-a"]?.title).toBe("Renamed")
    expect(deriveProductSessionMutationStatus(completed, "session-a", "rename")).toEqual({ state: "success", action })
  })

  test("keeps canonical state unchanged after rename failure", () => {
    const action: ProductSessionMutationAction = { type: "session.rename", sessionID: "session-a", title: "Renamed" }
    const pending = beginProductSessionMutation(hydratedSession(), action)
    if (!pending.ok) throw new Error("expected available mutation")
    const failed = failProductSessionMutation(pending.state, {
      type: "session.rename",
      sessionID: "session-a",
      error: { code: "HTTP_403", message: "Forbidden", raw: "HTTP 403 Forbidden" },
    })

    expect(failed.sessions["session-a"]?.title).toBe("Session A")
    expect(deriveProductSessionMutationStatus(failed, "session-a", "rename")).toEqual({
      state: "error",
      action,
      error: {
        code: "permission_denied",
        diagnosticCode: "HTTP_403",
        message: "Forbidden",
        raw: "HTTP 403 Forbidden",
        textKey: "error.session.permission_denied",
      },
    })
  })

  test("commits archive, share, and unshare only after host confirmation", () => {
    const archived = runSuccess(hydratedSession(), { type: "session.archive", sessionID: "session-a" }, {
      type: "session.archive",
      sessionID: "session-a",
      archivedAt: 100,
    })
    expect(archived.sessions["session-a"]?.archivedAt).toBe(100)
    expect(deriveProductSessionMutationAvailability(archived, { type: "session.archive", sessionID: "session-a" })).toEqual({ available: false, reason: "already_archived" })

    const shared = runSuccess(hydratedSession(), { type: "session.share", sessionID: "session-a" }, {
      type: "session.share",
      sessionID: "session-a",
      shareURL: "https://example.test/share",
    })
    expect(shared.sessions["session-a"]?.shareURL).toBe("https://example.test/share")
    expect(deriveProductSessionMutationAvailability(shared, { type: "session.share", sessionID: "session-a" })).toEqual({ available: false, reason: "already_shared" })

    const unshared = runSuccess(shared, { type: "session.unshare", sessionID: "session-a" }, {
      type: "session.unshare",
      sessionID: "session-a",
    })
    expect(unshared.sessions["session-a"]?.shareURL).toBeUndefined()
  })

  test("normalizes tag add and remove results without optimistic changes", () => {
    const addAction: ProductSessionMutationAction = { type: "session.tag.add", sessionID: "session-a", tag: " ops " }
    const pending = beginProductSessionMutation(hydratedSession(), addAction)
    if (!pending.ok) throw new Error("expected available mutation")
    expect(pending.intent).toEqual({
      type: "session.tag.add",
      sessionID: "session-a",
      tag: "ops",
      tags: ["docs", "ops"],
    })
    expect(pending.state.sessions["session-a"]?.tags).toEqual(["docs"])

    const added = completeProductSessionMutation(pending.state, {
      type: "session.tag.add",
      sessionID: "session-a",
      tags: ["ops", "docs", "ops", " "],
    })
    expect(added.sessions["session-a"]?.tags).toEqual(["docs", "ops"])

    const removed = runSuccess(added, { type: "session.tag.remove", sessionID: "session-a", tag: "docs" }, {
      type: "session.tag.remove",
      sessionID: "session-a",
      tags: ["ops"],
    })
    expect(removed.sessions["session-a"]?.tags).toEqual(["ops"])
  })
})

test("normalizes mutation errors into shared semantics while preserving diagnostics", () => {
  expect(normalizeProductSessionMutationError({ message: "Session not found", raw: "HTTP 404: Session not found" })).toEqual({
    code: "not_found",
    message: "Session not found",
    raw: "HTTP 404: Session not found",
    textKey: "error.session.not_found",
  })
  expect(normalizeProductSessionMutationError({ code: "NOT_IMPLEMENTED", message: "Unsupported endpoint" })).toEqual({
    code: "unsupported",
    diagnosticCode: "NOT_IMPLEMENTED",
    message: "Unsupported endpoint",
    raw: "Unsupported endpoint",
    textKey: "error.session.unsupported",
  })
  expect(normalizeProductSessionMutationError({ message: "socket closed" })).toEqual({
    code: "request_failed",
    message: "socket closed",
    raw: "socket closed",
    textKey: "error.session.request_failed",
  })
})

function runSuccess(
  state: ReturnType<typeof hydratedSession>,
  action: ProductSessionMutationAction,
  result: Parameters<typeof completeProductSessionMutation>[1],
) {
  const pending = beginProductSessionMutation(state, action)
  if (!pending.ok) throw new Error(`expected available mutation: ${pending.reason}`)
  return completeProductSessionMutation(pending.state, result)
}
