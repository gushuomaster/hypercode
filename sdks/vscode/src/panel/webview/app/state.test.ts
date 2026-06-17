import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { SessionSnapshot } from "../../../bridge/types"
import { createInitialState, normalizeSessionPickerPayload, normalizeSnapshotPayload, persistableAppState, resetSessionScopedComposerState, sameSessionRef, type PersistedAppState } from "./state"

const initialRef = {
  workspaceId: "vscode-remote://ssh-remote+box/workspace",
  dir: "/workspace",
  sessionId: "session-1",
} as const

function persisted(overrides: Partial<PersistedAppState> = {}): PersistedAppState {
  return {
    workspaceId: initialRef.workspaceId,
    dir: initialRef.dir,
    sessionId: initialRef.sessionId,
    composerAgentOverride: "plan",
    composerModelOverrides: {
      build: { providerID: "provider-a", modelID: "model-a" },
    },
    composerRecentModels: [{ providerID: "provider-a", modelID: "model-a" }],
    composerFavoriteModels: [{ providerID: "provider-f", modelID: "model-f" }],
    composerModelVariants: { "provider-a:model-a": "fast" },
    ...overrides,
  }
}

describe("panel webview persisted state", () => {
  test("sameSessionRef matches by workspace id and session id", () => {
    assert.equal(sameSessionRef(initialRef, { ...initialRef }), true)
    assert.equal(sameSessionRef(initialRef, { ...initialRef, sessionId: "session-2" }), false)
    assert.equal(sameSessionRef(initialRef, {
      workspaceId: "vscode-remote://ssh-remote+other/workspace",
      dir: initialRef.dir,
      sessionId: initialRef.sessionId,
    }), false)
  })

  test("defaults the snapshot display panel theme to classic", () => {
    const state = createInitialState(initialRef)

    assert.equal(state.snapshot.display.panelTheme, "classic")
    assert.equal(state.snapshot.display.panelColorScheme, "default")
    assert.equal(state.snapshot.display.showSkillsInSlashAutocomplete, false)
  })

  test("uses host-provided display settings for the initial snapshot", () => {
    const state = createInitialState(initialRef, undefined, {
      showInternals: true,
      showThinking: false,
      diffMode: "split",
      compactSkillInvocations: false,
      showSkillsInSlashAutocomplete: true,
      panelTheme: "classic",
      panelColorScheme: "verdant",
    })

    assert.deepEqual(state.snapshot.display, {
      showInternals: true,
      showThinking: false,
      diffMode: "split",
      compactSkillInvocations: false,
      showSkillsInSlashAutocomplete: true,
      panelTheme: "classic",
      panelColorScheme: "verdant",
    })
  })

  test("reuses session-scoped composer state when workspace id and session id match", () => {
    const state = createInitialState(initialRef, persisted())

    assert.equal(state.composerAgentOverride, "plan")
    assert.deepEqual(state.composerModelOverrides, {
      build: { providerID: "provider-a", modelID: "model-a" },
    })
    assert.deepEqual(state.composerRecentModels, [{ providerID: "provider-a", modelID: "model-a" }])
    assert.deepEqual(state.composerFavoriteModels, [{ providerID: "provider-f", modelID: "model-f" }])
    assert.deepEqual(state.composerModelVariants, { "provider-a:model-a": "fast" })
  })

  test("reuses session-scoped state for legacy persisted entries without workspace id", () => {
    const legacy = persisted()
    delete (legacy as Partial<PersistedAppState>).workspaceId

    const state = createInitialState(initialRef, legacy as PersistedAppState)

    assert.equal(state.composerAgentOverride, "plan")
    assert.deepEqual(state.composerRecentModels, [{ providerID: "provider-a", modelID: "model-a" }])
  })

  test("does not reuse session-scoped state when workspace id changes but dir stays the same", () => {
    const state = createInitialState(initialRef, persisted({
      workspaceId: "vscode-remote://ssh-remote+other/workspace",
    }))

    assert.equal(state.composerAgentOverride, undefined)
    assert.deepEqual(state.composerModelOverrides, {})
    assert.deepEqual(state.composerRecentModels, [])
    assert.deepEqual(state.composerModelVariants, {})
    assert.deepEqual(state.composerFavoriteModels, [{ providerID: "provider-f", modelID: "model-f" }])
  })

  test("does not reuse session-scoped state when session id changes", () => {
    const state = createInitialState(initialRef, persisted({ sessionId: "session-2" }))

    assert.equal(state.composerAgentOverride, undefined)
    assert.deepEqual(state.composerModelOverrides, {})
    assert.deepEqual(state.composerRecentModels, [])
  })

  test("persistableAppState writes workspace identity and normalizes model data", () => {
    const state = createInitialState(initialRef)
    state.composerAgentOverride = "plan"
    state.composerModelOverrides = {
      build: { providerID: " provider-a ", modelID: " model-a " },
      invalid: { providerID: "", modelID: "model-b" } as never,
    }
    state.composerRecentModels = [
      { providerID: " provider-a ", modelID: " model-a " },
      { providerID: "", modelID: "model-b" } as never,
    ]
    state.composerFavoriteModels = [
      { providerID: " provider-f ", modelID: " model-f " },
      { providerID: "", modelID: "model-b" } as never,
    ]
    state.composerModelVariants = {
      "provider-a:model-a": " fast ",
      broken: "   ",
    }

    assert.deepEqual(persistableAppState(state), {
      workspaceId: initialRef.workspaceId,
      dir: initialRef.dir,
      sessionId: initialRef.sessionId,
      composerAgentOverride: "plan",
      composerModelOverrides: {
        build: { providerID: "provider-a", modelID: "model-a" },
      },
      composerRecentModels: [{ providerID: "provider-a", modelID: "model-a" }],
      composerFavoriteModels: [{ providerID: "provider-f", modelID: "model-f" }],
      composerModelVariants: { "provider-a:model-a": "fast" },
    })
  })

  test("resetSessionScopedComposerState clears only session-scoped composer state", () => {
    const state = createInitialState(initialRef, persisted())
    state.draft = "/test hello"
    state.composerMentions = [{ type: "agent", name: "build", content: "@build", start: 0, end: 6 }]
    state.pendingCommandPromptInvocations = [{ command: "test", arguments: "hello" }]
    state.commandPromptInvocations = {
      test: { command: "test", arguments: "hello" },
    }
    state.imageAttachments = [{ id: "img-1", dataUrl: "data:image/png;base64,AA==", mime: "image/png", name: "a.png" }]
    state.error = "boom"
    state.form.selected = { test: ["one"] }

    const next = resetSessionScopedComposerState(state)

    assert.equal(next.composerAgentOverride, undefined)
    assert.deepEqual(next.composerModelOverrides, {})
    assert.deepEqual(next.composerRecentModels, [])
    assert.deepEqual(next.composerModelVariants, {})
    assert.equal(next.draft, "")
    assert.deepEqual(next.composerMentions, [])
    assert.deepEqual(next.pendingCommandPromptInvocations, [])
    assert.deepEqual(next.commandPromptInvocations, {})
    assert.deepEqual(next.imageAttachments, [])
    assert.equal(next.error, "")
    assert.deepEqual(next.form, { selected: {}, custom: {}, reject: {} })
    assert.deepEqual(next.composerFavoriteModels, [{ providerID: "provider-f", modelID: "model-f" }])
  })
})

describe("normalizeSnapshotPayload", () => {
  test("preserves message history metadata from incoming snapshots", () => {
    const snapshot = {
      status: "ready",
      workspaceName: "workspace",
      sessionRef: {
        workspaceId: initialRef.workspaceId,
        dir: initialRef.dir,
        sessionId: initialRef.sessionId,
      },
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified",
        compactSkillInvocations: true,
        panelTheme: "classic",
      },
      messageHistory: {
        limit: 400,
        hasEarlier: true,
      },
      messages: [],
      childMessages: {},
      childSessions: {},
      submitting: false,
      todos: [],
      diff: [],
      permissions: [],
      questions: [],
      agents: [],
      providers: [],
      mcp: {},
      mcpResources: {},
      lsp: [],
      commands: [],
      relatedSessionIds: [],
      agentMode: "build",
      navigation: {},
    } satisfies SessionSnapshot

    assert.deepEqual(normalizeSnapshotPayload(snapshot).messageHistory, {
      limit: 400,
      hasEarlier: true,
    })
  })

  test("preserves panelTheme from incoming snapshots", () => {
    const snapshot = {
      status: "ready",
      workspaceName: "workspace",
      sessionRef: {
        workspaceId: initialRef.workspaceId,
        dir: initialRef.dir,
        sessionId: initialRef.sessionId,
      },
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified",
        compactSkillInvocations: true,
        panelTheme: "classic",
      },
      messages: [],
      childMessages: {},
      childSessions: {},
      submitting: false,
      todos: [],
      diff: [],
      permissions: [],
      questions: [],
      agents: [],
      providers: [],
      mcp: {},
      mcpResources: {},
      lsp: [],
      commands: [],
      relatedSessionIds: [],
      agentMode: "build",
      navigation: {},
    } satisfies SessionSnapshot

    assert.equal(normalizeSnapshotPayload(snapshot).display.panelTheme, "classic")
  })

  test("defaults missing panelTheme to classic when normalizing older snapshots", () => {
    const snapshot = {
      status: "ready",
      workspaceName: "workspace",
      sessionRef: {
        workspaceId: initialRef.workspaceId,
        dir: initialRef.dir,
        sessionId: initialRef.sessionId,
      },
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified",
        compactSkillInvocations: true,
      },
      messages: [],
      childMessages: {},
      childSessions: {},
      submitting: false,
      todos: [],
      diff: [],
      permissions: [],
      questions: [],
      agents: [],
      providers: [],
      mcp: {},
      mcpResources: {},
      lsp: [],
      commands: [],
      relatedSessionIds: [],
      agentMode: "build",
      navigation: {},
    } as unknown as SessionSnapshot

    assert.equal(normalizeSnapshotPayload(snapshot).display.panelTheme, "classic")
  })

  test("defaults missing showSkillsInSlashAutocomplete to false when normalizing older snapshots", () => {
    const snapshot = {
      status: "ready",
      workspaceName: "workspace",
      sessionRef: {
        workspaceId: initialRef.workspaceId,
        dir: initialRef.dir,
        sessionId: initialRef.sessionId,
      },
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified",
        compactSkillInvocations: true,
        panelTheme: "classic",
      },
      messages: [],
      childMessages: {},
      childSessions: {},
      submitting: false,
      todos: [],
      diff: [],
      permissions: [],
      questions: [],
      agents: [],
      providers: [],
      mcp: {},
      mcpResources: {},
      lsp: [],
      commands: [],
      relatedSessionIds: [],
      agentMode: "build",
      navigation: {},
    } as unknown as SessionSnapshot

    assert.equal(normalizeSnapshotPayload(snapshot).display.showSkillsInSlashAutocomplete, false)
  })

  test("defaults missing message history metadata for older snapshots", () => {
    const snapshot = {
      status: "ready",
      workspaceName: "workspace",
      sessionRef: {
        workspaceId: initialRef.workspaceId,
        dir: initialRef.dir,
        sessionId: initialRef.sessionId,
      },
      display: {
        showInternals: false,
        showThinking: true,
        diffMode: "unified",
        compactSkillInvocations: true,
        panelTheme: "classic",
      },
      messages: [],
      childMessages: {},
      childSessions: {},
      submitting: false,
      todos: [],
      diff: [],
      permissions: [],
      questions: [],
      agents: [],
      providers: [],
      mcp: {},
      mcpResources: {},
      lsp: [],
      commands: [],
      relatedSessionIds: [],
      agentMode: "build",
      navigation: {},
    } as unknown as SessionSnapshot

    assert.deepEqual(normalizeSnapshotPayload(snapshot).messageHistory, {
      limit: 0,
      hasEarlier: false,
    })
  })
})

describe("normalizeSessionPickerPayload", () => {
  test("normalizes missing session picker fields to safe defaults", () => {
    assert.deepEqual(normalizeSessionPickerPayload(undefined as never), {
      workspaceName: "",
      currentSessionId: "",
      items: [],
    })
  })

  test("preserves valid picker entries and drops malformed tag arrays", () => {
    assert.deepEqual(normalizeSessionPickerPayload({
      workspaceName: "workspace",
      currentSessionId: "session-1",
      items: [{
        session: {
          id: "session-2",
          directory: "/workspace",
          title: "Child",
          time: { created: 2, updated: 2 },
        },
        tags: ["docs", 1, null] as unknown as string[],
        related: true,
      }],
    }), {
      workspaceName: "workspace",
      currentSessionId: "session-1",
      items: [{
        session: {
          id: "session-2",
          directory: "/workspace",
          title: "Child",
          time: { created: 2, updated: 2 },
        },
        tags: ["docs"],
        related: true,
      }],
    })
  })
})
