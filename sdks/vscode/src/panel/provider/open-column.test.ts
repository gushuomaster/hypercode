import assert from "node:assert/strict"
import { describe, test } from "node:test"
import * as vscode from "vscode"

import { SessionPanelController } from "./controller"
import { SessionPanelManager } from "./index"

describe("SessionPanelController.reveal", () => {
  test("reveals the panel in its existing editor column by default", async () => {
    const revealed: vscode.ViewColumn[] = []
    const controller = Object.create(SessionPanelController.prototype) as SessionPanelController

    Reflect.set(controller, "push", async () => {})
    Reflect.set(controller, "panel", {
      viewColumn: 5,
      reveal(viewColumn: vscode.ViewColumn) {
        revealed.push(viewColumn)
      },
    } as unknown as vscode.WebviewPanel)

    await controller.reveal()

    assert.deepEqual(revealed, [5])
  })
})

describe("SessionPanelManager.open", () => {
  test("requests composer focus after opening a new session panel", async () => {
    const focused: string[] = []
    const manager = Object.create(SessionPanelManager.prototype) as SessionPanelManager

    Reflect.set(manager, "panels", new Map())
    Reflect.set(manager, "createController", () => ({
      panel: {},
      push: async () => {},
      requestComposerFocus: async () => {
        focused.push("focus")
      },
    }))

    await manager.open({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-new",
    })

    assert.deepEqual(focused, ["focus"])
  })

  test("creates new session panels in the existing HyperCode group before splitting again", async () => {
    const created: vscode.ViewColumn[] = []
    const manager = Object.create(SessionPanelManager.prototype) as SessionPanelManager
    const existingKey = "file:///workspace::session-open"

    Reflect.set(manager, "panels", new Map([[existingKey, {
      ref: {
        workspaceId: "file:///workspace",
        dir: "/workspace",
        sessionId: "session-open",
      },
      panel: {
        viewColumn: 4,
      },
    }]]))
    Reflect.set(manager, "createController", (_ref: unknown, viewColumn?: vscode.ViewColumn) => {
      created.push(viewColumn ?? vscode.ViewColumn.Active)
      return {
        panel: {},
        push: async () => {},
        requestComposerFocus: async () => {},
      }
    })

    await manager.open({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-new",
    }, vscode.ViewColumn.Beside)

    assert.deepEqual(created, [4])
  })

  test("locks the editor group after opening a new session panel", async () => {
    const executed: string[] = []
    const manager = Object.create(SessionPanelManager.prototype) as SessionPanelManager
    const original = vscode.commands.executeCommand

    Reflect.set(manager, "panels", new Map())
    Reflect.set(manager, "createController", () => ({
      panel: {},
      push: async () => {},
      requestComposerFocus: async () => {},
    }))
    Reflect.set(vscode.commands, "executeCommand", async (command: string) => {
      executed.push(command)
    })

    try {
      await manager.open({
        workspaceId: "file:///workspace",
        dir: "/workspace",
        sessionId: "session-new",
      })
    } finally {
      Reflect.set(vscode.commands, "executeCommand", original)
    }

    assert.deepEqual(executed, ["workbench.action.lockEditorGroup"])
  })

  test("re-locks the editor group when revealing an existing session panel", async () => {
    const executed: string[] = []
    const steps: string[] = []
    const focused: string[] = []
    const manager = Object.create(SessionPanelManager.prototype) as SessionPanelManager
    const original = vscode.commands.executeCommand
    const existingKey = "file:///workspace::session-open"

    Reflect.set(manager, "panels", new Map([[existingKey, {
      ref: {
        workspaceId: "file:///workspace",
        dir: "/workspace",
        sessionId: "session-open",
      },
      panel: {},
      reveal: async () => {
        steps.push("reveal")
      },
      requestComposerFocus: async () => {
        focused.push("focus")
      },
    }]]))
    Reflect.set(vscode.commands, "executeCommand", async (command: string) => {
      executed.push(command)
      steps.push(command)
    })

    try {
      await manager.open({
        workspaceId: "file:///workspace",
        dir: "/workspace",
        sessionId: "session-open",
      })
    } finally {
      Reflect.set(vscode.commands, "executeCommand", original)
    }

    assert.deepEqual(steps, ["reveal", "workbench.action.lockEditorGroup"])
    assert.deepEqual(executed, ["workbench.action.lockEditorGroup"])
    assert.deepEqual(focused, ["focus"])
  })
})

describe("SessionPanelManager.retarget", () => {
  test("locks the editor group after replacing a session in place", async () => {
    const executed: string[] = []
    const manager = Object.create(SessionPanelManager.prototype) as SessionPanelManager
    const original = vscode.commands.executeCommand
    const currentKey = "file:///workspace::session-open"

    Reflect.set(manager, "panels", new Map([[currentKey, {
      panel: {},
      retarget: async () => {},
      requestComposerFocus: async () => {},
    }]]))
    Reflect.set(vscode.commands, "executeCommand", async (command: string) => {
      executed.push(command)
    })

    try {
      await manager.retarget({
        workspaceId: "file:///workspace",
        dir: "/workspace",
        sessionId: "session-open",
      }, {
        workspaceId: "file:///workspace",
        dir: "/workspace",
        sessionId: "session-next",
      })
    } finally {
      Reflect.set(vscode.commands, "executeCommand", original)
    }

    assert.deepEqual(executed, ["workbench.action.lockEditorGroup"])
  })
})
