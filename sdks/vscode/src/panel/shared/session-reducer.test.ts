import assert from "node:assert/strict"
import { describe, test } from "node:test"

import type { SessionSnapshot } from "../../bridge/types"
import type { DisplaySettings } from "../../core/settings"
import { reduceSessionSnapshot } from "./session-reducer"
import { rawSessionLifecycleEvents } from "../../../../../packages/product/test/fixtures/session-events"

function snapshot(overrides: Partial<SessionSnapshot> & { display?: DisplaySettings } = {}): SessionSnapshot {
  return {
    status: "ready",
    workspaceName: "workspace",
    sessionRef: { workspaceId: "file:///workspace", dir: "/workspace", sessionId: "root" },
    session: {
      id: "root",
      directory: "/workspace",
      title: "root",
      time: { created: 1, updated: 1 },
    },
    message: "ready",
    sessionStatus: { type: "idle" },
    messages: [{
      info: { id: "m1", sessionID: "root", role: "assistant", time: { created: 1 } },
      parts: [],
    }],
    childMessages: {},
    childSessions: {},
    submitting: false,
    todos: [],
    diff: [],
    permissions: [],
    questions: [],
    agents: [],
    defaultAgent: undefined,
    providers: [],
    providerDefault: undefined,
    configuredModel: undefined,
    mcp: {},
    mcpResources: {},
    lsp: [],
    commands: [],
    relatedSessionIds: ["root"],
    agentMode: "build",
    navigation: {},
    ...overrides,
    display: overrides.display ?? {
      showInternals: false,
      showThinking: true,
      diffMode: "unified",
      panelTheme: "classic",
    },
  }
}

describe("reduceSessionSnapshot subtree sessions", () => {
  test("adds child session incrementally for root panel", () => {
    const current = snapshot()
    const next = reduceSessionSnapshot(current, {
      type: "session.created",
      properties: {
        info: {
          id: "child-1",
          directory: "/workspace",
          parentID: "root",
          title: "child",
          time: { created: 2, updated: 2 },
        },
      },
    })

    assert.ok(next)
    assert.deepEqual(next.relatedSessionIds, ["root", "child-1"])
    assert.equal(next.childSessions["child-1"]?.title, "child")
    assert.equal(next.navigation.firstChild?.id, "child-1")
    assert.strictEqual(next.messages, current.messages)
  })

  test("updates child session title without replacing main transcript", () => {
    const current = snapshot({
      childSessions: {
        "child-1": {
          id: "child-1",
          directory: "/workspace",
          parentID: "root",
          title: "before",
          time: { created: 2, updated: 2 },
        },
      },
      relatedSessionIds: ["root", "child-1"],
      navigation: {
        firstChild: { id: "child-1", title: "before" },
      },
    })
    const next = reduceSessionSnapshot(current, {
      type: "session.updated",
      properties: {
        info: {
          id: "child-1",
          directory: "/workspace",
          parentID: "root",
          title: "after",
          time: { created: 2, updated: 3 },
        },
      },
    })

    assert.ok(next)
    assert.equal(next.childSessions["child-1"]?.title, "after")
    assert.equal(next.navigation.firstChild?.title, "after")
    assert.strictEqual(next.messages, current.messages)
  })

  test("prunes pending state when updated child leaves subtree", () => {
    const current = snapshot({
      childSessions: {
        "child-1": {
          id: "child-1",
          directory: "/workspace",
          parentID: "root",
          title: "child",
          time: { created: 2, updated: 2 },
        },
      },
      childMessages: {
        "child-1": [{ info: { id: "c1", sessionID: "child-1", role: "assistant", time: { created: 1 } }, parts: [] }],
      },
      permissions: [{ id: "p1", sessionID: "child-1", permission: "edit", patterns: [], metadata: {}, always: [] }],
      questions: [{ id: "q1", sessionID: "child-1", questions: [] }],
      relatedSessionIds: ["root", "child-1"],
      navigation: {
        firstChild: { id: "child-1", title: "child" },
      },
    })
    const next = reduceSessionSnapshot(current, {
      type: "session.updated",
      properties: {
        info: {
          id: "child-1",
          directory: "/workspace",
          parentID: "elsewhere",
          title: "moved",
          time: { created: 2, updated: 3 },
        },
      },
    })

    assert.ok(next)
    assert.deepEqual(next.relatedSessionIds, ["root"])
    assert.deepEqual(next.childMessages, {})
    assert.deepEqual(next.permissions, [])
    assert.deepEqual(next.questions, [])
  })

  test("removes deleted child subtree and related child data", () => {
    const current = snapshot({
      childSessions: {
        "child-1": {
          id: "child-1",
          directory: "/workspace",
          parentID: "root",
          title: "child",
          time: { created: 2, updated: 2 },
        },
        "grand-1": {
          id: "grand-1",
          directory: "/workspace",
          parentID: "child-1",
          title: "grand",
          time: { created: 3, updated: 3 },
        },
      },
      childMessages: {
        "child-1": [{ info: { id: "c1", sessionID: "child-1", role: "assistant", time: { created: 1 } }, parts: [] }],
        "grand-1": [{ info: { id: "g1", sessionID: "grand-1", role: "assistant", time: { created: 1 } }, parts: [] }],
      },
      permissions: [{ id: "p1", sessionID: "grand-1", permission: "edit", patterns: [], metadata: {}, always: [] }],
      questions: [{ id: "q1", sessionID: "child-1", questions: [] }],
      relatedSessionIds: ["root", "child-1", "grand-1"],
      navigation: {
        firstChild: { id: "child-1", title: "child" },
      },
    })
    const next = reduceSessionSnapshot(current, {
      type: "session.deleted",
      properties: {
        info: {
          id: "child-1",
          directory: "/workspace",
          parentID: "root",
          title: "child",
          time: { created: 2, updated: 2 },
        },
      },
    })

    assert.ok(next)
    assert.deepEqual(next.relatedSessionIds, ["root"])
    assert.deepEqual(next.childSessions, {})
    assert.deepEqual(next.childMessages, {})
    assert.deepEqual(next.permissions, [])
    assert.deepEqual(next.questions, [])
  })
})

describe("reduceSessionSnapshot product projection", () => {
  test("maintains the canonical product snapshot while applying incremental host events", () => {
    const final = rawSessionLifecycleEvents.reduce((current, event) => {
      const next = reduceSessionSnapshot(current, event)
      assert.ok(next)
      return next
    }, snapshot({
      sessionRef: { workspaceId: "file:///workspace", dir: "/workspace", sessionId: "session-1" },
      session: {
        id: "session-1",
        directory: "/workspace",
        title: "session",
        time: { created: 1, updated: 1 },
      },
      messages: [],
      relatedSessionIds: ["session-1"],
    }))

    assert.equal(final.product?.status, "idle")
    assert.equal(final.product?.messages.length, 1)
    assert.deepEqual(final.product?.tools, [{
      id: "part-tool",
      messageID: "message-1",
      sessionID: "session-1",
      name: "bash",
      callID: "call-1",
      status: "completed",
    }])
    assert.deepEqual(final.product?.resolved, {
      permissions: ["permission-1"],
      questions: ["question-1"],
    })
  })

  test("keeps child lifecycle events out of the root product status", () => {
    const payload = snapshot({
      childSessions: {
        child: {
          id: "child",
          directory: "/workspace",
          parentID: "root",
          title: "child",
          time: { created: 1, updated: 1 },
        },
      },
      relatedSessionIds: ["root", "child"],
    })
    const next = reduceSessionSnapshot(payload, {
      type: "session.status",
      properties: { sessionID: "child", status: { type: "busy" } },
    } as SessionEvent)

    assert.equal(next?.product?.status, "idle")
  })
})
