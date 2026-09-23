import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createProductSessionMutationState, hydrateProductMutableSessions } from "@opencode-ai/product"
import { mutableSession } from "../../../../../../packages/product/test/fixtures/session-mutations"
import {
  reduceVsCodeSessionMutation,
  toVsCodeMutableSession,
  toVsCodeSessionMutationTarget,
} from "./product-session-mutation-adapter"
import { runVsCodeSessionMutation } from "../../../product/session-mutation"

describe("VSCode session mutation adapter", () => {
  test("maps normalized Product intents to host execution targets", () => {
    const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession])

    assert.deepEqual(
      toVsCodeSessionMutationTarget(state, { type: "session.rename", sessionID: "session-a", title: " Renamed " }, "/workspace"),
      {
        kind: "session.update",
        input: { sessionID: "session-a", directory: "/workspace", title: "Renamed" },
        state: {
          ...state,
          mutations: {
            "session-a": {
              rename: {
                state: "pending",
                action: { type: "session.rename", sessionID: "session-a", title: " Renamed " },
              },
            },
          },
        },
      },
    )

    assert.deepEqual(
      toVsCodeSessionMutationTarget(state, { type: "session.tag.add", sessionID: "session-a", tag: " ops " }, "/workspace"),
      {
        kind: "session.tags",
        input: { workspaceID: "/workspace", sessionID: "session-a", tags: ["docs", "ops"] },
        state: {
          ...state,
          mutations: {
            "session-a": {
              "tag.add": {
                state: "pending",
                action: { type: "session.tag.add", sessionID: "session-a", tag: " ops " },
              },
            },
          },
        },
      },
    )
  })

  test("hydrates all VSCode mutation capabilities without copying Core sessions", () => {
    assert.deepEqual(toVsCodeMutableSession({
      id: "session-a",
      title: " Session A ",
      time: { created: 1, updated: 2 },
      share: { url: "https://example.test/share" },
    }, [" docs ", "ops"], {
      rename: true,
      archive: true,
      share: true,
      unshare: true,
      tags: true,
    }), {
      id: "session-a",
      title: "Session A",
      shareURL: "https://example.test/share",
      tags: [" docs ", "ops"],
      available: true,
      capabilities: {
        rename: true,
        archive: true,
        share: true,
        unshare: true,
        tags: true,
      },
    })
  })

  test("reduces confirmed and failed Host mutation results through Product", () => {
    const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession])
    const pending = toVsCodeSessionMutationTarget(state, { type: "session.share", sessionID: "session-a" }, "/workspace")
    if (pending.kind !== "session.share") throw new Error("expected share target")

    const completed = reduceVsCodeSessionMutation(pending.state, {
      type: "success",
      result: { type: "session.share", sessionID: "session-a", shareURL: "https://example.test/share" },
    })
    assert.equal(completed.sessions["session-a"]?.shareURL, "https://example.test/share")
    assert.equal(completed.mutations["session-a"]?.share?.state, "success")

    const failed = reduceVsCodeSessionMutation(pending.state, {
      type: "failure",
      failure: {
        type: "session.share",
        sessionID: "session-a",
        error: { code: "HTTP_403", message: "Forbidden", raw: "HTTP 403 Forbidden" },
      },
    })
    assert.equal(failed.sessions["session-a"]?.shareURL, undefined)
    assert.deepEqual(failed.mutations["session-a"]?.share, {
      state: "error",
      action: { type: "session.share", sessionID: "session-a" },
      error: {
        code: "permission_denied",
        diagnosticCode: "HTTP_403",
        message: "Forbidden",
        raw: "HTTP 403 Forbidden",
        textKey: "error.session.permission_denied",
      },
    })
  })

  test("emits pending before host execution and confirms persisted tags", async () => {
    const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession])
    const target = toVsCodeSessionMutationTarget(state, { type: "session.tag.add", sessionID: "session-a", tag: "ops" }, "workspace-a")
    if (target.kind !== "session.tags") throw new Error("expected tags target")
    const events: unknown[] = []
    let persisted: unknown

    const result = await runVsCodeSessionMutation(target, {
      update: async () => undefined,
      archive: async () => 0,
      share: async () => "",
      unshare: async () => undefined,
      setTags: async (input) => {
        events.push("host")
        persisted = input
      },
    }, (event) => events.push(event))

    assert.deepEqual(persisted, { workspaceID: "workspace-a", sessionID: "session-a", tags: ["docs", "ops"] })
    assert.deepEqual(events.map((event) => typeof event === "string" ? event : (event as { type: string }).type), ["pending", "host", "success"])
    assert.equal(result.state.sessions["session-a"]?.tags.join(","), "docs,ops")
  })

  test("keeps canonical state unchanged and emits raw diagnostics on host failure", async () => {
    const state = hydrateProductMutableSessions(createProductSessionMutationState(), [mutableSession])
    const target = toVsCodeSessionMutationTarget(state, { type: "session.share", sessionID: "session-a" }, "/workspace")
    if (target.kind !== "session.share") throw new Error("expected share target")
    const events: unknown[] = []

    const result = await runVsCodeSessionMutation(target, {
      update: async () => undefined,
      archive: async () => 0,
      share: async () => { throw Object.assign(new Error("Forbidden"), { name: "HTTP_403" }) },
      unshare: async () => undefined,
      setTags: async () => undefined,
    }, (event) => events.push(event))

    assert.equal(result.ok, false)
    assert.equal(result.state.sessions["session-a"]?.shareURL, undefined)
    assert.deepEqual(events, [{
      type: "pending",
      session: state.sessions["session-a"],
      action: { type: "session.share", sessionID: "session-a" },
    }, {
      type: "failure",
      failure: {
        type: "session.share",
        sessionID: "session-a",
        error: { code: "HTTP_403", message: "Forbidden", raw: "Forbidden" },
      },
    }])
  })
})
