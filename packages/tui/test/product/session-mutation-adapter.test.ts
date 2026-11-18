import { expect, test } from "bun:test"
import { createProductSessionMutationState, hydrateProductMutableSessions } from "@opencode-ai/product"
import { mutableSession, supportedSessionMutations } from "../../../product/test/fixtures/session-mutations"
import {
  runTuiSessionMutation,
  toTuiMutableSession,
  toTuiSessionMutationTarget,
} from "../../src/product/session-mutation-adapter"

test("maps supported session mutations to TUI SDK targets with Product pending state", () => {
  const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession, {
    ...mutableSession,
    id: "session-shared",
    shareURL: "https://example.test/share",
  }])

  const rename = toTuiSessionMutationTarget(state, { type: "session.rename", sessionID: "session-a", title: " Renamed " })
  expect(rename).toMatchObject({
    kind: "session.update",
    input: { sessionID: "session-a", title: "Renamed" },
  })
  expect(rename.state.mutations["session-a"]?.rename?.state).toBe("pending")

  // Session sharing is discontinued: Product reports both directions as unsupported without pending state.
  expect(toTuiSessionMutationTarget(state, { type: "session.share", sessionID: "session-a" })).toMatchObject({
    kind: "unsupported",
    action: "session.share",
  })
  expect(toTuiSessionMutationTarget(state, { type: "session.unshare", sessionID: "session-shared" })).toMatchObject({
    kind: "unsupported",
    action: "session.unshare",
  })
})

test("reports unsupported TUI archive and tags without creating pending state", () => {
  const session = toTuiMutableSession({
    id: "session-a",
    title: "Session A",
    time: { created: 1, updated: 2 },
  }, { share: true })
  const state = hydrateProductMutableSessions(createProductSessionMutationState(), [session])

  expect(session.capabilities).toEqual({
    rename: true,
    archive: false,
    share: true,
    unshare: true,
    tags: false,
  })
  expect(toTuiSessionMutationTarget(state, { type: "session.archive", sessionID: "session-a" })).toEqual({
    kind: "unsupported",
    action: "session.archive",
    reason: "unsupported",
    state,
  })
  expect(toTuiSessionMutationTarget(state, { type: "session.tag.add", sessionID: "session-a", tag: "ops" })).toEqual({
    kind: "unsupported",
    action: "session.tag.add",
    reason: "unsupported",
    state,
  })
})

test("maps disabled sharing and repeated actions to explicit unavailable results", () => {
  const state = hydrateProductMutableSessions(createProductSessionMutationState(), [{
    ...mutableSession,
    capabilities: {
      ...supportedSessionMutations,
      share: false,
    },
  }])

  expect(toTuiSessionMutationTarget(state, { type: "session.share", sessionID: "session-a" })).toEqual({
    kind: "unsupported",
    action: "session.share",
    reason: "unsupported",
    state,
  })
  expect(toTuiSessionMutationTarget(state, { type: "session.tag.remove", sessionID: "session-a", tag: "missing" })).toEqual({
    kind: "unavailable",
    action: "session.tag.remove",
    reason: "missing_tag",
    state,
  })
})

test("runs TUI mutations through shared pending and confirmed Product states", async () => {
  const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession])
  const target = toTuiSessionMutationTarget(state, { type: "session.rename", sessionID: "session-a", title: "Renamed" })
  if (target.kind !== "session.update") throw new Error("expected update target")
  const lifecycles: string[] = []
  const result = await runTuiSessionMutation(target, {
    update: async () => {},
    share: async () => "",
    unshare: async () => {},
  }, (next) => lifecycles.push(next.mutations["session-a"]?.rename?.state ?? "idle"))

  expect(result.ok).toBe(true)
  expect(result.state.sessions["session-a"]?.title).toBe("Renamed")
  expect(lifecycles).toEqual(["pending", "success"])
})

test("keeps TUI canonical state unchanged when the host call fails", async () => {
  const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession])
  const target = toTuiSessionMutationTarget(state, { type: "session.rename", sessionID: "session-a", title: "Renamed" })
  if (target.kind !== "session.update") throw new Error("expected update target")
  const result = await runTuiSessionMutation(target, {
    update: async () => { throw Object.assign(new Error("Forbidden"), { name: "HTTP_403" }) },
    share: async () => "",
    unshare: async () => {},
  }, () => {})

  expect(result.ok).toBe(false)
  expect(result.state.sessions["session-a"]?.title).toBe(mutableSession.title)
  expect(result.state.mutations["session-a"]?.rename).toMatchObject({
    state: "error",
    error: {
      code: "permission_denied",
      diagnosticCode: "HTTP_403",
      raw: "Forbidden",
    },
  })
})
