import assert from "node:assert/strict"
import { test } from "node:test"
import * as vscode from "vscode"

import type { SessionPanelRef, WebviewMessage } from "../bridge/types"
import { SessionViewProvider } from "./session-view-provider"

test("new session messages stay in the sidebar", async () => {
  const ref = {
    workspaceId: "file:///workspace-a",
    dir: "/workspace-a",
    sessionId: "session-current",
  } satisfies SessionPanelRef
  let focusedListener = () => {}
  let messageListener = (_message: WebviewMessage) => {}
  const calls: Array<{ command: string; args: unknown[] }> = []
  const executeCommand = vscode.commands.executeCommand
  Object.defineProperty(vscode.commands, "executeCommand", {
    configurable: true,
    value: async (command: string, ...args: unknown[]) => {
      calls.push({ command, args })
    },
  })

  const provider = new SessionViewProvider(
    vscode.Uri.file("/extension"),
    {
      list: () => [],
      onDidChange: () => ({ dispose() {} }),
    } as never,
    {
      onDidEvent: () => ({ dispose() {} }),
    } as never,
    {
      onDidChange: (listener: () => void) => {
        focusedListener = listener
        return { dispose() {} }
      },
      snapshot: () => ({ ref }),
    } as never,
    { appendLine() {} } as never,
  )

  try {
    focusedListener()
    provider.resolveWebviewView({
      visible: true,
      webview: {
        cspSource: "test-csp",
        options: {},
        html: "",
        asWebviewUri: (uri: vscode.Uri) => uri,
        postMessage: async () => true,
        onDidReceiveMessage: (listener: (message: WebviewMessage) => void) => {
          messageListener = listener
          return { dispose() {} }
        },
      },
      onDidChangeVisibility: () => ({ dispose() {} }),
    } as never)

    messageListener({ type: "newSession" })
    await Promise.resolve()

    assert.deepEqual(calls, [{
      command: "hypercode.newSession",
      args: [ref],
    }])
  } finally {
    provider.dispose()
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: executeCommand,
    })
  }
})
