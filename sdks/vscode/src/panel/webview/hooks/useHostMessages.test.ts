import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { Dispatch, SetStateAction } from "react"
import { createProductSnapshot } from "@opencode-ai/product"

import type { HostMessage } from "../../../bridge/types"
import { setLocale } from "../../../i18n"
import { dispatchHostMessage } from "./useHostMessages"
import { createInitialState, type AppState } from "../app/state"

function applyStateUpdate(update: SetStateAction<AppState>, state: AppState) {
  return typeof update === "function"
    ? (update as (current: AppState) => AppState)(state)
    : update
}

function dispatch(message: HostMessage, initial: AppState) {
  let state = initial
  dispatchHostMessage(message, {
    fileRefStatus: new Map<string, boolean>(),
    onFileSearchResults: () => {},
    onFocusComposer: () => {},
    onRestoreComposer: () => {},
    onShellCommandSucceeded: () => {},
    setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
    setState: ((update: SetStateAction<AppState>) => {
      state = applyStateUpdate(update, state)
    }) as Dispatch<SetStateAction<AppState>>,
  })
  return state
}

describe("dispatchHostMessage", () => {
  test("reduces session mutation lifecycle messages into canonical Product state", () => {
    let state = createInitialState({ workspaceId: "workspace-a", dir: "/workspace", sessionId: "session-a" })
    const session = {
      id: "session-a",
      title: "Session A",
      tags: ["docs"],
      available: true,
      capabilities: {
        rename: true,
        archive: true,
        share: true,
        unshare: true,
        tags: true,
      },
    }

    state = dispatch({
      type: "sessionMutation",
      event: {
        type: "pending",
        session,
        action: { type: "session.rename", sessionID: "session-a", title: "Renamed" },
      },
    }, state)
    assert.equal(state.productSessions.mutation.sessions["session-a"]?.title, "Session A")
    assert.equal(state.productSessions.mutation.mutations["session-a"]?.rename?.state, "pending")

    state = dispatch({
      type: "sessionMutation",
      event: {
        type: "failure",
        failure: {
          type: "session.rename",
          sessionID: "session-a",
          error: { code: "HTTP_403", message: "Forbidden", raw: "HTTP 403 Forbidden" },
        },
      },
    }, state)
    assert.equal(state.productSessions.mutation.sessions["session-a"]?.title, "Session A")
    assert.deepEqual(state.productSessions.mutation.mutations["session-a"]?.rename, {
      state: "error",
      action: { type: "session.rename", sessionID: "session-a", title: "Renamed" },
      error: {
        code: "permission_denied",
        diagnosticCode: "HTTP_403",
        message: "Forbidden",
        raw: "HTTP 403 Forbidden",
        textKey: "error.session.permission_denied",
      },
    })
  })

  test("isolates canonical product state across bootstrap A to B to A switches", () => {
    let state = createInitialState({ workspaceId: "file:///workspace", dir: "/workspace", sessionId: "session-a" })
    const tool = {
      id: "tool-a",
      sessionID: "session-a",
      messageID: "message-a",
      type: "tool" as const,
      tool: "bash",
      state: { status: "running" as const, input: {} },
    }
    const message = {
      info: {
        id: "message-a",
        sessionID: "session-a",
        role: "assistant" as const,
        time: { created: 1 },
      },
      parts: [tool],
    }
    const productA = createProductSnapshot({
      status: "error",
      messages: [{
        id: "message-a",
        sessionID: "session-a",
        role: "assistant",
        createdAt: 1,
        parts: [{
          id: "tool-a",
          sessionID: "session-a",
          messageID: "message-a",
          type: "tool",
          tool: { name: "bash", status: "running" },
        }],
      }],
      permissions: [{ id: "permission-a", sessionID: "session-a" }],
      questions: [{ id: "question-pending-a", sessionID: "session-a" }],
      resolved: { permissions: [], questions: ["question-a"] },
      error: { message: "failed", raw: "HTTP 500" },
    })

    state = dispatch({
      type: "snapshot",
      reason: "test:session-a",
      payload: {
        ...state.snapshot,
        product: productA,
        status: "ready",
        workspaceName: "workspace",
        sessionRef: state.bootstrap.sessionRef,
        session: { id: "session-a", directory: "/workspace", title: "A", time: { created: 1, updated: 1 } },
        message: "ready",
        messages: [message],
      },
    }, state)

    state = dispatch({
      type: "bootstrap",
      payload: {
        status: "ready",
        workspaceName: "workspace",
        sessionRef: { ...state.bootstrap.sessionRef, sessionId: "session-b" },
        message: "switching",
      },
    }, state)
    state = dispatch({
      type: "snapshot",
      reason: "test:session-b",
      payload: {
        ...state.snapshot,
        product: undefined,
        status: "ready",
        workspaceName: "workspace",
        sessionRef: state.bootstrap.sessionRef,
        session: { id: "session-b", directory: "/workspace", title: "B", time: { created: 2, updated: 2 } },
        message: "ready",
        sessionStatus: { type: "idle" },
        messages: [],
        permissions: [],
        questions: [],
      },
    }, state)

    assert.equal(state.snapshot.product.status, "idle")
    assert.deepEqual(state.snapshot.product.permissions, [])
    assert.deepEqual(state.snapshot.product.questions, [])
    assert.deepEqual(state.snapshot.product.tools, [])
    assert.deepEqual(state.snapshot.product.resolved.questions, [])
    assert.equal(state.snapshot.product.error, undefined)

    state = dispatch({
      type: "bootstrap",
      payload: {
        status: "ready",
        workspaceName: "workspace",
        sessionRef: { ...state.bootstrap.sessionRef, sessionId: "session-a" },
        message: "switching",
      },
    }, state)
    state = dispatch({
      type: "snapshot",
      reason: "test:return-session-a",
      payload: {
        ...state.snapshot,
        product: undefined,
        status: "ready",
        workspaceName: "workspace",
        sessionRef: state.bootstrap.sessionRef,
        session: { id: "session-a", directory: "/workspace", title: "A", time: { created: 1, updated: 3 } },
        message: "ready",
        sessionStatus: { type: "idle" },
        messages: [message],
        permissions: [],
        questions: [],
      },
    }, state)

    assert.equal(state.snapshot.product.status, "error")
    assert.deepEqual(state.snapshot.product.permissions, [{ id: "permission-a", sessionID: "session-a" }])
    assert.deepEqual(state.snapshot.product.questions, [{ id: "question-pending-a", sessionID: "session-a" }])
    assert.equal(state.snapshot.product.tools[0]?.id, "tool-a")
    assert.deepEqual(state.snapshot.product.resolved.questions, ["question-a"])
    assert.equal(state.snapshot.product.error?.raw, "HTTP 500")
  })

  test("preserves resolved interactions across same-session snapshot refreshes", () => {
    const initial = createInitialState({ workspaceId: "file:///workspace", dir: "/workspace", sessionId: "session-1" })
    const state = dispatch({
      type: "snapshot",
      reason: "test:same-session",
      payload: {
        ...initial.snapshot,
        product: undefined,
        status: "ready",
        workspaceName: "workspace",
        sessionRef: initial.bootstrap.sessionRef,
        message: "ready",
        questions: [{ id: "question-1", sessionID: "session-1", questions: [] }],
      },
    }, {
      ...initial,
      snapshot: {
        ...initial.snapshot,
        product: createProductSnapshot({ resolved: { permissions: [], questions: ["question-1"] } }),
      },
    })

    assert.deepEqual(state.snapshot.product.questions, [])
    assert.deepEqual(state.snapshot.product.resolved.questions, ["question-1"])
  })

  test("does not inherit canonical product state when a snapshot switches sessions", () => {
    const initial = createInitialState({ workspaceId: "file:///workspace", dir: "/workspace", sessionId: "session-1" })
    const state = dispatch({
      type: "snapshot",
      reason: "test:session-switch",
      payload: {
        ...initial.snapshot,
        product: undefined,
        status: "ready",
        workspaceName: "workspace",
        sessionRef: { ...initial.bootstrap.sessionRef, sessionId: "session-2" },
        message: "ready",
        questions: [{ id: "question-1", sessionID: "session-2", questions: [] }],
      },
    }, {
      ...initial,
      snapshot: {
        ...initial.snapshot,
        product: createProductSnapshot({ resolved: { permissions: [], questions: ["question-1"] } }),
      },
    })

    assert.deepEqual(state.snapshot.product.questions, [{ id: "question-1", sessionID: "session-2" }])
    assert.deepEqual(state.snapshot.product.resolved.questions, [])
  })

  test("hydrates canonical pending interaction from deferred updates", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({ workspaceId: "file:///workspace", dir: "/workspace", sessionId: "session-1" })

    dispatchHostMessage({
      type: "deferredUpdate",
      reason: "initial:deferred",
      payload: {
        sessionStatus: { type: "busy" },
        permissions: [{ id: "permission-1", sessionID: "session-1", permission: "read", patterns: [] }],
        questions: [{ id: "question-1", sessionID: "session-1", questions: [] }],
        providerAuth: {},
        mcp: {},
        mcpResources: {},
        lsp: [],
        formatter: [],
        commands: [],
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(state.snapshot.product.status, "running")
    assert.deepEqual(state.snapshot.product.permissions, [{ id: "permission-1", sessionID: "session-1" }])
    assert.deepEqual(state.snapshot.product.questions, [{ id: "question-1", sessionID: "session-1" }])
  })

  test("localizes missing host error details", () => {
    setLocale("zh")
    const fileRefStatus = new Map<string, boolean>()
    let error = ""

    dispatchHostMessage({ type: "error", message: "" } satisfies HostMessage, {
      fileRefStatus,
      onErrorMessage: (message) => {
        error = message
      },
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: (() => {}) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(error, "未知错误")
  })

  test("dispatches shellCommandSucceeded to callback", () => {
    let called = 0
    const fileRefStatus = new Map<string, boolean>()

    dispatchHostMessage({ type: "shellCommandSucceeded" } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {
        called += 1
      },
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: (() => {}) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(called, 1)
  })

  test("dispatches restoreComposer to callback", () => {
    let restored: string | null = null
    const fileRefStatus = new Map<string, boolean>()

    dispatchHostMessage({
      type: "restoreComposer",
      parts: [{ type: "text", text: "echo hi" }],
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: (payload) => {
        restored = payload.parts.map((p) => p.type === "text" ? p.text : "").join("")
      },
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: (() => {}) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(restored, "echo hi")
  })

  test("dispatches focusComposer to callback", () => {
    let called = 0
    const fileRefStatus = new Map<string, boolean>()

    dispatchHostMessage({ type: "focusComposer" } satisfies HostMessage, {
      fileRefStatus,
      onErrorMessage: () => {},
      onFileSearchResults: () => {},
      onFocusComposer: () => {
        called += 1
      },
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: (() => {}) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(called, 1)
  })

  test("stores sessionPicker payload on app state", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    dispatchHostMessage({
      type: "sessionPicker",
      payload: {
        workspaceName: "workspace",
        currentSessionId: "session-1",
        items: [{
          session: {
            id: "session-2",
            directory: "/workspace",
            title: "Related",
            time: { created: 2, updated: 2 },
          },
          tags: ["docs"],
          related: true,
        }],
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.deepEqual(state.sessionPicker, {
      workspaceName: "workspace",
      currentSessionId: "session-1",
      items: [{
        session: {
          id: "session-2",
          directory: "/workspace",
          title: "Related",
          time: { created: 2, updated: 2 },
        },
        tags: ["docs"],
        related: true,
      }],
    })
  })

  test("applies sessionEvent incrementally and preserves unchanged message references", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const userMessage = {
      info: {
        id: "m1",
        sessionID: "session-1",
        role: "user" as const,
        time: { created: 1 },
      },
      parts: [{
        id: "p1",
        sessionID: "session-1",
        messageID: "m1",
        type: "text" as const,
        text: "hello",
      }],
    }
    const assistantText = {
      id: "p2",
      sessionID: "session-1",
      messageID: "m2",
      type: "text" as const,
      text: "before",
    }
    const assistantMessage = {
      info: {
        id: "m2",
        sessionID: "session-1",
        role: "assistant" as const,
        time: { created: 2 },
      },
      parts: [assistantText],
    }

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:snapshot",
      payload: {
        status: "ready",
        workspaceName: "workspace",
        sessionRef: state.bootstrap.sessionRef,
        session: {
          id: "session-1",
          directory: "/workspace",
          title: "session-1",
          time: { created: 0, updated: 0 },
        },
        message: "ready",
        display: {
          showInternals: false,
          showThinking: true,
          diffMode: "unified" as const,
          panelTheme: "classic" as const,
        },
        sessionStatus: { type: "idle" },
        messages: [userMessage, assistantMessage],
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
        relatedSessionIds: ["session-1"],
        agentMode: "build",
        navigation: {},
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    const previousUser = state.snapshot.messages[0]
    const previousAssistant = state.snapshot.messages[1]
    const previousAssistantText = previousAssistant?.parts[0]

    dispatchHostMessage({
      type: "sessionEvent",
      event: {
        type: "message.part.delta",
        properties: {
          sessionID: "session-1",
          messageID: "m2",
          partID: "p2",
          field: "text",
          delta: " after",
        },
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.strictEqual(state.snapshot.messages[0], previousUser)
    assert.notStrictEqual(state.snapshot.messages[1], previousAssistant)
    assert.notStrictEqual(state.snapshot.messages[1]?.parts[0], previousAssistantText)
    assert.equal(state.snapshot.messages[1]?.parts[0]?.type, "text")
    assert.equal(state.snapshot.messages[1]?.parts[0]?.type === "text" ? state.snapshot.messages[1].parts[0].text : undefined, "before after")
  })

  test("reconciles full snapshot updates and preserves unchanged message references", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const userMessage = {
      info: {
        id: "m1",
        sessionID: "session-1",
        role: "user" as const,
        time: { created: 1 },
      },
      parts: [{
        id: "p1",
        sessionID: "session-1",
        messageID: "m1",
        type: "text" as const,
        text: "hello",
      }],
    }
    const assistantMessage = {
      info: {
        id: "m2",
        sessionID: "session-1",
        role: "assistant" as const,
        time: { created: 2 },
      },
      parts: [{
        id: "p2",
        sessionID: "session-1",
        messageID: "m2",
        type: "text" as const,
        text: "before",
      }],
    }

    const basePayload = {
      status: "ready" as const,
      workspaceName: "workspace",
      sessionRef: state.bootstrap.sessionRef,
      session: {
        id: "session-1",
        directory: "/workspace",
        title: "session-1",
        time: { created: 0, updated: 0 },
      },
      message: "ready",
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified" as const,
        panelTheme: "classic" as const,
      },
      sessionStatus: { type: "idle" as const },
      messages: [userMessage, assistantMessage],
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
      relatedSessionIds: ["session-1"],
      agentMode: "build" as const,
      navigation: {},
    }

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:initial",
      payload: basePayload,
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    const previousUser = state.snapshot.messages[0]
    const previousAssistant = state.snapshot.messages[1]
    const previousAssistantPart = previousAssistant?.parts[0]

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:session-updated",
      payload: {
        ...basePayload,
        session: {
          ...basePayload.session,
          title: "session-1 renamed",
        },
        messages: [
          {
            info: { ...userMessage.info, time: { ...userMessage.info.time } },
            parts: [{ ...userMessage.parts[0] }],
          },
          {
            info: { ...assistantMessage.info, time: { ...assistantMessage.info.time } },
            parts: [{ ...assistantMessage.parts[0] }],
          },
        ],
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.strictEqual(state.snapshot.messages[0], previousUser)
    assert.strictEqual(state.snapshot.messages[1], previousAssistant)
    assert.strictEqual(state.snapshot.messages[1]?.parts[0], previousAssistantPart)
    assert.equal(state.snapshot.session?.title, "session-1 renamed")
  })

  test("preserves unchanged child message list references across metadata-only snapshots", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const childMessage = {
      info: {
        id: "cm1",
        sessionID: "child-1",
        role: "assistant" as const,
        time: { created: 3 },
      },
      parts: [{
        id: "cp1",
        sessionID: "child-1",
        messageID: "cm1",
        type: "text" as const,
        text: "child message",
      }],
    }

    const payload = {
      status: "ready" as const,
      workspaceName: "workspace",
      sessionRef: state.bootstrap.sessionRef,
      session: {
        id: "session-1",
        directory: "/workspace",
        title: "session-1",
        time: { created: 0, updated: 0 },
      },
      message: "ready",
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified" as const,
        panelTheme: "classic" as const,
      },
      sessionStatus: { type: "idle" as const },
      messages: [],
      childMessages: {
        "child-1": [childMessage],
      },
      childSessions: {
        "child-1": {
          id: "child-1",
          directory: "/workspace",
          parentID: "session-1",
          title: "child-1",
          time: { created: 0, updated: 0 },
        },
      },
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
      relatedSessionIds: ["session-1", "child-1"],
      agentMode: "build" as const,
      navigation: {},
    }

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:initial-child",
      payload,
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    const previousChildMessages = state.snapshot.childMessages["child-1"]
    const previousChildPart = previousChildMessages?.[0]?.parts[0]

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:metadata-only-child",
      payload: {
        ...payload,
        sessionStatus: { type: "busy" as const },
        childMessages: {
          "child-1": [{
            info: { ...childMessage.info, time: { ...childMessage.info.time } },
            parts: [{ ...childMessage.parts[0] }],
          }],
        },
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.strictEqual(state.snapshot.childMessages["child-1"], previousChildMessages)
    assert.strictEqual(state.snapshot.childMessages["child-1"]?.[0]?.parts[0], previousChildPart)
    assert.equal(state.snapshot.sessionStatus?.type, "busy")
  })

  test("clears session-scoped composer overrides when a snapshot switches to a different session", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })
    state.draft = "/test hello"
    state.composerAgentOverride = "Sisyphus - Ultraworker"
    state.composerModelOverrides = {
      "Sisyphus - Ultraworker": { providerID: "openai", modelID: "gpt-5.5" },
    }
    state.composerRecentModels = [{ providerID: "openai", modelID: "gpt-5.5" }]
    state.composerFavoriteModels = [{ providerID: "opencode", modelID: "big-pickle" }]
    state.commandPromptInvocations = {
      test: { command: "test", arguments: "hello" },
    }

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:switched-session",
      payload: {
        status: "ready",
        workspaceName: "workspace",
        sessionRef: {
          workspaceId: "file:///workspace",
          dir: "/workspace",
          sessionId: "session-2",
        },
        session: {
          id: "session-2",
          directory: "/workspace",
          title: "session-2",
          time: { created: 0, updated: 0 },
        },
        message: "ready",
        display: {
          showInternals: false,
          showThinking: true,
          diffMode: "unified" as const,
          panelTheme: "classic" as const,
        },
        sessionStatus: { type: "idle" as const },
        messages: [],
        childMessages: {},
        childSessions: {},
        submitting: false,
        todos: [],
        diff: [],
        permissions: [],
        questions: [],
        agents: [
          { name: "Sisyphus - Ultraworker", mode: "primary" as const },
          { name: "build", mode: "primary" as const },
        ],
        defaultAgent: "Sisyphus - Ultraworker",
        providers: [],
        providerDefault: undefined,
        configuredModel: undefined,
        mcp: {},
        mcpResources: {},
        lsp: [],
        commands: [],
        relatedSessionIds: ["session-2"],
        agentMode: "build" as const,
        navigation: {},
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(state.bootstrap.sessionRef.sessionId, "session-2")
    assert.equal(state.composerAgentOverride, undefined)
    assert.deepEqual(state.composerModelOverrides, {})
    assert.deepEqual(state.composerRecentModels, [])
    assert.deepEqual(state.commandPromptInvocations, {})
    assert.equal(state.draft, "")
    assert.deepEqual(state.composerFavoriteModels, [{ providerID: "opencode", modelID: "big-pickle" }])
  })

  test("keeps newer transcript text when a stale snapshot arrives after incremental streaming", () => {
    const fileRefStatus = new Map<string, boolean>()
    let state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const assistantMessage = {
      info: {
        id: "m1",
        sessionID: "session-1",
        role: "assistant" as const,
        time: { created: 1 },
      },
      parts: [{
        id: "p1",
        sessionID: "session-1",
        messageID: "m1",
        type: "text" as const,
        text: "before",
      }],
    }

    const payload = {
      status: "ready" as const,
      workspaceName: "workspace",
      sessionRef: state.bootstrap.sessionRef,
      session: {
        id: "session-1",
        directory: "/workspace",
        title: "session-1",
        time: { created: 0, updated: 0 },
      },
      message: "ready",
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified" as const,
        panelTheme: "classic" as const,
      },
      sessionStatus: { type: "busy" as const },
      messages: [assistantMessage],
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
      relatedSessionIds: ["session-1"],
      agentMode: "build" as const,
      navigation: {},
    }

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:stream-initial",
      payload,
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    dispatchHostMessage({
      type: "sessionEvent",
      event: {
        type: "message.part.delta",
        properties: {
          sessionID: "session-1",
          messageID: "m1",
          partID: "p1",
          field: "text",
          delta: " after",
        },
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    dispatchHostMessage({
      type: "snapshot",
      reason: "test:stream-stale",
      payload: {
        ...payload,
        session: {
          ...payload.session,
          title: "session-1 renamed",
        },
        messages: [{
          info: { ...assistantMessage.info, time: { ...assistantMessage.info.time } },
          parts: [{ ...assistantMessage.parts[0] }],
        }],
      },
    } satisfies HostMessage, {
      fileRefStatus,
      onFileSearchResults: () => {},
      onFocusComposer: () => {},
      onRestoreComposer: () => {},
      onShellCommandSucceeded: () => {},
      setPendingMcpActions: (() => {}) as Dispatch<SetStateAction<Record<string, boolean>>>,
      setState: ((update: SetStateAction<AppState>) => {
        state = applyStateUpdate(update, state)
      }) as Dispatch<SetStateAction<AppState>>,
    })

    assert.equal(state.snapshot.messages[0]?.parts[0]?.type, "text")
    assert.equal(state.snapshot.messages[0]?.parts[0]?.type === "text" ? state.snapshot.messages[0].parts[0].text : undefined, "before after")
    assert.equal(state.snapshot.session?.title, "session-1 renamed")
  })

  test("keeps canonical product failures across a deferred legacy status update", () => {
    let state = createInitialState({ workspaceId: "workspace-a", dir: "/workspace", sessionId: "session-a" })
    state = dispatch({
      type: "snapshot",
      reason: "test:error",
      payload: {
        ...state.snapshot,
        product: createProductSnapshot({
          status: "error",
          error: { message: "Bad Request", raw: "HTTP 400" },
        }),
        status: "ready",
        workspaceName: "workspace",
        sessionRef: state.bootstrap.sessionRef,
        message: "error",
        messages: [],
      },
    }, state)

    state = dispatch({
      type: "deferredUpdate",
      reason: "test:error:deferred",
      payload: {
        product: state.snapshot.product,
        sessionStatus: { type: "idle" },
        permissions: [],
        questions: [],
      },
    }, state)

    assert.deepEqual(state.snapshot.product.error, { message: "Bad Request", raw: "HTTP 400" })
    assert.equal(state.snapshot.product.status, "error")
  })
})
