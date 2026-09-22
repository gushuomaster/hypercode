import * as vscode from "vscode"
import type { RuntimeState } from "./server"
import { displaySessionTitle } from "./session-titles"
import { WorkspaceManager } from "./workspace"
import { SessionPanelManager } from "../panel/provider"
import { t } from "../i18n"

type RuntimeChoice = {
  workspaceId: string
  state: RuntimeState
}

export function deriveStatusBarState(input: {
  activeSessionTitle?: string
  activeSessionBusy?: boolean
  runtimeState?: RuntimeState
}) {
  if (input.activeSessionTitle) {
    return {
      text: `${input.activeSessionBusy ? "$(loading~spin)" : "$(comment-discussion)"} HyperCode ${input.activeSessionTitle}`,
      tooltip: input.activeSessionBusy
        ? t("status.openSessionBusy", { title: input.activeSessionTitle })
        : t("status.openSession", { title: input.activeSessionTitle }),
      command: "hypercode.statusBarAction",
      busy: !!input.activeSessionBusy,
    }
  }

  if (input.runtimeState === "starting") {
    return {
      text: t("status.starting.text"),
      tooltip: t("status.starting.tooltip"),
      command: "hypercode.statusBarAction",
      busy: false,
    }
  }

  if (input.runtimeState === "error") {
    return {
      text: t("status.unavailable.text"),
      tooltip: t("status.unavailable.tooltip"),
      command: "hypercode.statusBarAction",
      busy: false,
    }
  }

  return {
    text: "$(comment-discussion) HyperCode",
    tooltip: t("status.open"),
    command: "hypercode.statusBarAction",
    busy: false,
  }
}

export class HyperCodeStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10)
  private readonly bag: vscode.Disposable[] = []

  constructor(
    private mgr: WorkspaceManager,
    private panels: SessionPanelManager,
  ) {
    this.item.name = "HyperCode"
    this.item.command = "hypercode.statusBarAction"

    this.bag.push(
      this.mgr.onDidChange(() => {
        this.update()
      }),
      this.panels.onDidChangeActiveSession(() => {
        this.update()
      }),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.update()
      }),
    )

    this.update()
    this.item.show()
  }

  dispose() {
    vscode.Disposable.from(...this.bag).dispose()
    this.item.dispose()
  }

  private update() {
    const state = this.currentState()
    this.item.text = state.text
    this.item.tooltip = state.tooltip
    this.item.command = state.command
    this.item.show()
  }

  private currentState() {
    const active = this.panels.activeSession()

    if (active) {
      const rt = this.mgr.get(active.workspaceId)
      const session = rt?.sessions.get(active.sessionId)
      const status = rt?.sessionStatuses.get(active.sessionId)
      return deriveStatusBarState({
        activeSessionTitle: displaySessionTitle(session?.title, active.sessionId),
        activeSessionBusy: status?.type === "busy",
        runtimeState: rt?.state,
      })
    }

    const runtime = pickPreferredRuntime(this.mgr.list(), activeEditorWorkspaceId())
    return deriveStatusBarState({
      runtimeState: runtime?.state,
    })
  }
}

export function pickPreferredRuntime(runtimes: RuntimeChoice[], activeWorkspaceId?: string) {
  if (activeWorkspaceId) {
    const activeRuntime = runtimes.find((rt) => rt.workspaceId === activeWorkspaceId)
    if (activeRuntime) {
      return activeRuntime
    }
  }

  return runtimes[0]
}

function activeEditorWorkspaceId() {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return undefined
  }

  const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
  return folder?.uri.toString()
}
