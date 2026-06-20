import * as vscode from "vscode"
import type { WorkspaceRef } from "../bridge/types"
import type { SessionInfo, SessionStatus } from "./sdk"
import { openSettingsQuery } from "./settings"
import { checkOpencodeAvailable, runtimeNotReadyMessage } from "./runtime-errors"
import { ClearSearchItem, ClearTagFilterItem, SessionItem, WorkspaceItem } from "../sidebar/item"
import type { WorkspaceRuntime } from "./server"
import { parseSessionTagsInput, SessionTagStore } from "./session-tags"
import { SessionStore } from "./session"
import { displaySessionTitle, isDefaultNewSessionTitle } from "./session-titles"
import { TabManager } from "./tabs"
import { WorkspaceManager } from "./workspace"
import { SessionPanelManager } from "../panel/provider"
import { buildEditorSeed, buildExplorerSeed, type LaunchSeed } from "./launch-context"
import { applySessionSearchCapabilityResult, CapabilityState, CapabilityStore, classifyCapabilityError, createEmptyCapabilities, type RuntimeCapabilities } from "./capabilities"
import { SidebarProvider } from "../sidebar/provider"
import { buildSessionPickerPayload } from "../panel/provider/actions"
import { openLicenseFile } from "../license"

type SessionActionRuntime = Pick<WorkspaceRuntime, "workspaceId" | "dir" | "name" | "state"> & {
  sdk?: {
    session: {
      update?(input: {
        sessionID: string
        directory: string
        title?: string
        time?: {
          archived?: number
        }
      }): Promise<{ data?: SessionInfo }>
      share?(input: {
        sessionID: string
        directory: string
      }): Promise<{ data?: SessionInfo }>
      unshare?(input: {
        sessionID: string
        directory: string
      }): Promise<{ data?: SessionInfo }>
    }
  }
}

export type SessionActionTarget = {
  runtime: SessionActionRuntime
  session: SessionInfo
}

type SessionActionInput = {
  target: SessionActionTarget
  sessions: Pick<SessionStore, "refresh">
  showInformationMessage: (message: string) => Thenable<unknown>
  showErrorMessage: (message: string) => Thenable<unknown>
}

export function commands(
  ctx: vscode.ExtensionContext,
  mgr: WorkspaceManager,
  sessions: SessionStore,
  out: vscode.OutputChannel,
  tabs: TabManager,
  panels: SessionPanelManager,
  capabilities: CapabilityStore,
  tags: SessionTagStore,
  tree: SidebarProvider,
) {
  ctx.subscriptions.push(
    vscode.commands.registerCommand("hypercode.refresh", async () => {
      const folders = vscode.workspace.workspaceFolders ?? []
      await mgr.sync(folders)
      await sessions.refreshAll()
    }),
    vscode.commands.registerCommand("hypercode.openOutput", () => {
      out.show(true)
    }),
    vscode.commands.registerCommand("hypercode.openLicenseFile", async () => {
      await openLicenseFile()
    }),
    vscode.commands.registerCommand("hypercode.openSettings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", openSettingsQuery())
    }),
    vscode.commands.registerCommand("hypercode.openProviderDocs", async () => {
      const readme = vscode.Uri.joinPath(ctx.extensionUri, "README.md")
      await vscode.commands.executeCommand("markdown.showPreview", readme)
    }),
    vscode.commands.registerCommand("hypercode.checkEnvironment", async () => {
      const host = vscode.env.remoteName || "local"
      const result = await checkOpencodeAvailable()

      if (result.ok) {
        await vscode.window.showInformationMessage(`HyperCode 运行时在当前 ${host} 主机上可用：${result.output}`)
        return
      }

      await vscode.window.showErrorMessage(`HyperCode 环境检查失败（${host}）：${result.message}`)
    }),
    vscode.commands.registerCommand("hypercode.copyImagePreview", async () => {
      await panels.runImagePreviewCommand("copy")
    }),
    vscode.commands.registerCommand("hypercode.saveImagePreview", async () => {
      await panels.runImagePreviewCommand("save")
    }),
    vscode.commands.registerCommand("hypercode.newSession", async (item?: WorkspaceItem) => {
      const rt = item?.runtime ?? firstRuntime(mgr)

      if (!rt) {
        await vscode.window.showInformationMessage("请先打开一个工作区文件夹。")
        return
      }

      if (!rt || rt.state !== "ready") {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      await vscode.commands.executeCommand("hypercode.newSessionAndOpen", workspaceRef(rt))
    }),
    vscode.commands.registerCommand("hypercode.newSessionAndOpen", async (workspace?: WorkspaceRef) => {
      const rt = workspace ? mgr.get(workspace.workspaceId) : firstRuntime(mgr)

      if (!rt) {
        await vscode.window.showInformationMessage("请先打开一个工作区文件夹。")
        return
      }

      if (!rt || rt.state !== "ready") {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      const target = await acquireNewSessionTarget(rt, sessions, out)
      await vscode.commands.executeCommand("hypercode.openSessionById", workspaceRef(rt), target.session.id, resolveNewSessionOpenColumn())
      void cleanupStaleNewSessions(rt, target.stale, sessions, tabs, out)
    }),
    vscode.commands.registerCommand("hypercode.newSessionInPlace", async (current?: WorkspaceRef & { sessionId: string }) => {
      const rt = current ? mgr.get(current.workspaceId) : firstRuntime(mgr)

      if (!rt) {
        await vscode.window.showInformationMessage("请先打开一个工作区文件夹。")
        return
      }

      if (rt.state !== "ready") {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      const target = await acquireNewSessionTarget(rt, sessions, out)
      const nextRef = { ...workspaceRef(rt), sessionId: target.session.id }

      if (current) {
        await panels.retarget(current, nextRef)
      } else {
        await panels.open(nextRef)
      }

      void cleanupStaleNewSessions(rt, target.stale, sessions, tabs, out)
    }),
    vscode.commands.registerCommand("hypercode.restartWorkspaceServer", async (item?: WorkspaceItem) => {
      const rt = item?.runtime

      if (!rt) {
        await vscode.window.showInformationMessage("请选择一个工作区项以重启其服务。")
        return
      }

      capabilities.clear(rt.workspaceId)
      await mgr.restart(rt.workspaceId)
      await sessions.refresh(rt.workspaceId, true)
    }),
    vscode.commands.registerCommand("hypercode.refreshWorkspaceSessions", async (item?: WorkspaceItem) => {
      const rt = item?.runtime

      if (!rt) {
        await vscode.window.showInformationMessage("请选择一个工作区项以刷新其会话。")
        return
      }

      await sessions.refresh(rt.workspaceId)
    }),
    vscode.commands.registerCommand("hypercode.openWorkspaceInBrowser", async (item?: WorkspaceItem) => {
      await openWorkspaceInBrowser({
        runtime: item?.runtime,
        openExternal: (uri) => vscode.env.openExternal(uri),
        showInformationMessage: (message) => vscode.window.showInformationMessage(message),
        showErrorMessage: (message) => vscode.window.showErrorMessage(message),
      })
    }),
    vscode.commands.registerCommand("hypercode.openSession", async (item?: SessionItem) => {
      if (!item) {
        await vscode.window.showInformationMessage("请先选择一个会话项。")
        return
      }

      await tabs.openSession(workspaceRef(item.runtime), item.session, resolveNewSessionOpenColumn())
    }),
    vscode.commands.registerCommand("hypercode.openSessionById", async (workspace?: WorkspaceRef, sessionID?: string, viewColumn?: vscode.ViewColumn) => {
      if (!workspace || !sessionID) {
        return
      }

      const rt = mgr.get(workspace.workspaceId)

      if (!rt || rt.state !== "ready" || !rt.sdk) {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      const res = await rt.sdk.session.get({
        sessionID,
        directory: rt.dir,
      })

      if (!res.data) {
        await vscode.window.showInformationMessage("未找到会话。")
        return
      }

      await tabs.openSession(workspaceRef(rt), res.data, viewColumn ?? resolveNewSessionOpenColumn())
    }),
    vscode.commands.registerCommand("hypercode.forkSessionMessage", async (current?: WorkspaceRef & { sessionId: string }, messageID?: string) => {
      if (!current || !messageID) {
        return
      }

      const rt = mgr.get(current.workspaceId)

      if (!rt || rt.state !== "ready" || !rt.sdk) {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      try {
        const forked = await forkSessionMessage({
          runtime: rt,
          current,
          messageID,
        })

        if (!forked) {
          await vscode.window.showInformationMessage("所选消息已不可用。")
          return
        }

        void capabilities.getOrProbe(rt.workspaceId)
        await tabs.openSession(workspaceRef(rt), forked, resolveNewSessionOpenColumn())
        void sessions.refresh(rt.workspaceId, true)
      } catch (error) {
        await vscode.window.showErrorMessage(`HyperCode 派生失败（${rt.name}）：${errorMessage(error)}`)
      }
    }),
    vscode.commands.registerCommand("hypercode.renameSession", async (item?: SessionItem) => {
      const target = await resolveSessionActionTarget(item, mgr)
      if (!target) {
        return
      }

      await renameSession({
        target,
        sessions,
        showInputBox: (options) => vscode.window.showInputBox(options),
        showInformationMessage: (message) => vscode.window.showInformationMessage(message),
        showErrorMessage: (message) => vscode.window.showErrorMessage(message),
      })
    }),
    vscode.commands.registerCommand("hypercode.archiveSession", async (item?: SessionItem) => {
      const target = await resolveSessionActionTarget(item, mgr)
      if (!target) {
        return
      }

      await archiveSession({
        target,
        sessions,
        closeSession: () => tabs.closeSession(workspaceRef(target.runtime), target.session.id),
        showWarningMessage: (message, options, ...items) => vscode.window.showWarningMessage(message, options, ...items),
        showInformationMessage: (message) => vscode.window.showInformationMessage(message),
        showErrorMessage: (message) => vscode.window.showErrorMessage(message),
      })
    }),
    vscode.commands.registerCommand("hypercode.shareSession", async (item?: SessionItem) => {
      const target = await resolveSessionActionTarget(item, mgr)
      if (!target) {
        return
      }

      await shareSession({
        target,
        sessions,
        copyText: (value) => vscode.env.clipboard.writeText(value),
        showInformationMessage: (message) => vscode.window.showInformationMessage(message),
        showErrorMessage: (message) => vscode.window.showErrorMessage(message),
      })
    }),
    vscode.commands.registerCommand("hypercode.unshareSession", async (item?: SessionItem) => {
      const target = await resolveSessionActionTarget(item, mgr)
      if (!target) {
        return
      }

      await unshareSession({
        target,
        sessions,
        showInformationMessage: (message) => vscode.window.showInformationMessage(message),
        showErrorMessage: (message) => vscode.window.showErrorMessage(message),
      })
    }),
    vscode.commands.registerCommand("hypercode.getSessionPickerPayload", async (current?: WorkspaceRef & { sessionId: string }, relatedSessionIds?: string[]) => {
      if (!current) {
        return undefined
      }

      const rt = mgr.get(current.workspaceId)
      if (!rt || rt.state !== "ready" || !rt.sdk) {
        return undefined
      }

      await sessions.refresh(rt.workspaceId, true)
      return buildSessionPickerPayload({
        workspaceName: rt.name,
        currentSessionId: current.sessionId,
        relatedSessionIds: relatedSessionIds ?? [],
        sessions: sessions.list(rt.workspaceId),
        tagsBySessionId: tags.tagsBySession(rt.workspaceId),
      })
    }),
    vscode.commands.registerCommand("hypercode.switchSessionInPlace", async (current?: WorkspaceRef & { sessionId: string }, sessionID?: string) => {
      if (!current || !sessionID || current.sessionId === sessionID) {
        return
      }

      const rt = mgr.get(current.workspaceId)
      if (!rt || rt.state !== "ready") {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      await panels.retarget(current, {
        ...workspaceRef(rt),
        sessionId: sessionID,
      })
    }),
    vscode.commands.registerCommand("hypercode.sessionPickerAction", async (
      current?: WorkspaceRef & { sessionId: string },
      sessionID?: string,
      action?: "rename" | "share" | "unshare" | "archive" | "tags",
    ) => {
      if (!current || !sessionID || !action) {
        return
      }

      const rt = mgr.get(current.workspaceId)
      if (!rt || rt.state !== "ready" || !rt.sdk) {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      await sessions.refresh(rt.workspaceId, true)
      const session = sessions.list(rt.workspaceId).find((item) => item.id === sessionID)
      if (!session) {
        await vscode.window.showInformationMessage("未找到会话。")
        return
      }

      const target = {
        runtime: rt,
        session,
      } satisfies SessionActionTarget

      if (action === "rename") {
        await renameSession({
          target,
          sessions,
          showInputBox: (options) => vscode.window.showInputBox(options),
          showInformationMessage: (message) => vscode.window.showInformationMessage(message),
          showErrorMessage: (message) => vscode.window.showErrorMessage(message),
        })
        return
      }

      if (action === "share") {
        await shareSession({
          target,
          sessions,
          copyText: (value) => vscode.env.clipboard.writeText(value),
          showInformationMessage: (message) => vscode.window.showInformationMessage(message),
          showErrorMessage: (message) => vscode.window.showErrorMessage(message),
        })
        return
      }

      if (action === "unshare") {
        await unshareSession({
          target,
          sessions,
          showInformationMessage: (message) => vscode.window.showInformationMessage(message),
          showErrorMessage: (message) => vscode.window.showErrorMessage(message),
        })
        return
      }

      if (action === "archive") {
        await archiveSession({
          target,
          sessions,
          closeSession: () => tabs.closeSession(workspaceRef(target.runtime), target.session.id),
          showWarningMessage: (message, options, ...items) => vscode.window.showWarningMessage(message, options, ...items),
          showInformationMessage: (message) => vscode.window.showInformationMessage(message),
          showErrorMessage: (message) => vscode.window.showErrorMessage(message),
        })
        return
      }

      await manageSessionTags({
        target,
        tags,
        showInputBox: (options) => vscode.window.showInputBox(options),
      })
    }),
    vscode.commands.registerCommand("hypercode.quickNewSession", async () => {
      const rt = runtimeFromActiveEditor(mgr) ?? firstRuntime(mgr)

      if (!rt) {
        await vscode.window.showInformationMessage("请先打开一个工作区文件夹。")
        return
      }

      if (rt.state !== "ready") {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      const target = await acquireNewSessionTarget(rt, sessions, out)
      const ref = { ...workspaceRef(rt), sessionId: target.session.id }
      await panels.open(ref, resolveNewSessionOpenColumn())
      void cleanupStaleNewSessions(rt, target.stale, sessions, tabs, out)
    }),
    vscode.commands.registerCommand("hypercode.askSelection", async () => {
      const seed = seedFromActiveEditor("selection")
      if (!seed) {
        await vscode.window.showInformationMessage("请先在工作区文件中选中一段文本。")
        return
      }

      await openSeededSession(seed, mgr, sessions, panels, capabilities)
    }),
    vscode.commands.registerCommand("hypercode.askCurrentFile", async () => {
      const seed = seedFromActiveEditor("file")
      if (!seed) {
        await vscode.window.showInformationMessage("请先打开一个工作区文件。")
        return
      }

      await openSeededSession(seed, mgr, sessions, panels, capabilities)
    }),
    vscode.commands.registerCommand("hypercode.askExplorerFiles", async (item?: vscode.Uri, items?: vscode.Uri[]) => {
      const seed = seedFromExplorerSelection(item, items)
      if (!seed) {
        await vscode.window.showInformationMessage("请先在同一个工作区文件夹中选择一个或多个文件。")
        return
      }

      await openSeededSession(seed, mgr, sessions, panels, capabilities)
    }),
    vscode.commands.registerCommand("hypercode.searchWorkspaceSessions", async (item?: WorkspaceItem) => {
      const rt = item?.runtime

      if (!rt) {
        await vscode.window.showInformationMessage("请选择一个工作区项以搜索其会话。")
        return
      }

      if (rt.state !== "ready" || !rt.sdk) {
        await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
        return
      }

      const query = await vscode.window.showInputBox(buildWorkspaceSearchInputOptions(rt.name, tree.searchQuery(rt.workspaceId)))

      await runWorkspaceSessionSearch({
        runtime: rt,
        query,
        capability: capabilities.snapshot(rt.workspaceId).sessionSearch,
        snapshot: capabilities.snapshot(rt.workspaceId),
        capabilities,
        sidebar: tree,
        showInformationMessage: (message) => vscode.window.showInformationMessage(message),
        showErrorMessage: (message) => vscode.window.showErrorMessage(message),
      })
    }),
    vscode.commands.registerCommand("hypercode.clearWorkspaceSessionSearch", async (item?: WorkspaceItem | ClearSearchItem) => {
      const workspaceId = item?.runtime.workspaceId

      if (!workspaceId) {
        await vscode.window.showInformationMessage("请选择要清除搜索的工作区。")
        return
      }

      tree.clearSearch(workspaceId)
    }),
    vscode.commands.registerCommand("hypercode.manageSessionTags", async (item?: SessionItem) => {
      if (!item) {
        await vscode.window.showInformationMessage("请先选择一个会话项。")
        return
      }

      await manageSessionTags({
        target: {
          runtime: item.runtime as SessionActionRuntime,
          session: item.session,
        },
        tags,
        showInputBox: (options) => vscode.window.showInputBox(options),
      })
      tree.refresh()
    }),
    vscode.commands.registerCommand("hypercode.filterWorkspaceSessionsByTag", async (item?: WorkspaceItem) => {
      const rt = item?.runtime

      if (!rt) {
        await vscode.window.showInformationMessage("请选择一个工作区项以筛选其会话。")
        return
      }

      const available = tags.workspaceTags(rt.workspaceId)
      if (available.length === 0) {
        await vscode.window.showInformationMessage(`${rt.name} 暂无本地标签。`)
        return
      }

      const choice = await vscode.window.showQuickPick(
        available.map((tag) => ({ label: tag })),
        {
          title: `筛选 ${rt.name} 的会话`,
          placeHolder: "选择一个标签",
          ignoreFocusOut: true,
        },
      )

      if (!choice) {
        return
      }

      tree.filterByTag(rt.workspaceId, choice.label)
    }),
    vscode.commands.registerCommand("hypercode.clearWorkspaceTagFilter", async (item?: WorkspaceItem | ClearTagFilterItem) => {
      const workspaceId = item?.runtime.workspaceId

      if (!workspaceId) {
        await vscode.window.showInformationMessage("请选择要清除标签筛选的工作区。")
        return
      }

      tree.clearTagFilter(workspaceId)
    }),
    vscode.commands.registerCommand("hypercode.statusBarAction", async () => {
      const active = panels.activeSession()
      if (active) {
        await panels.open(active)
        return
      }

      const rt = runtimeFromActiveEditor(mgr)
      if (rt) {
        if (rt.state !== "ready") {
          await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
          return
        }

        void capabilities.getOrProbe(rt.workspaceId)
        const target = await acquireNewSessionTarget(rt, sessions, out)
        await panels.open({
          workspaceId: rt.workspaceId,
          dir: rt.dir,
          sessionId: target.session.id,
        }, resolveNewSessionOpenColumn())
        void cleanupStaleNewSessions(rt, target.stale, sessions, tabs, out)
        return
      }

      await vscode.commands.executeCommand("workbench.view.extension.hypercode")
    }),
  )

  function seedFromActiveEditor(mode: "selection" | "file") {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return undefined
    }

    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
    if (!folder) {
      return undefined
    }

    const selection = editor.selection
    if (mode === "selection" && selection.isEmpty) {
      return undefined
    }

    return buildEditorSeed({
      workspaceId: folder.uri.toString(),
      workspaceDir: folder.uri.fsPath,
      filePath: editor.document.uri.fsPath,
      selection: {
        startLine: selection.start.line + 1,
        endLine: selection.isEmpty ? undefined : selection.end.line + 1,
        empty: mode === "file" ? true : selection.isEmpty,
      },
    })
  }

  function seedFromExplorerSelection(item?: vscode.Uri, items?: vscode.Uri[]) {
    const uris = items?.length ? items : item ? [item] : []
    if (!uris.length) {
      return undefined
    }

    const folder = vscode.workspace.getWorkspaceFolder(uris[0]!)
    if (!folder) {
      return undefined
    }

    const sameWorkspaceFiles = uris.filter((uri) => vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() === folder.uri.toString())
    if (!sameWorkspaceFiles.length || sameWorkspaceFiles.length !== uris.length) {
      return undefined
    }

    return buildExplorerSeed({
      workspaceId: folder.uri.toString(),
      workspaceDir: folder.uri.fsPath,
      filePaths: sameWorkspaceFiles.map((uri) => uri.fsPath),
    })
  }
}

type SearchRuntime = Pick<WorkspaceRuntime, "workspaceId" | "dir" | "name" | "state"> & {
  sdk?: {
    session: {
      list(input: {
        directory: string
        roots: true
        search: string
      }): Promise<{ data?: import("./sdk").SessionInfo[] }>
    }
  }
}

type WorkspaceSessionSearchInput = {
  runtime: SearchRuntime
  query: string | undefined
  capability: CapabilityState
  snapshot?: RuntimeCapabilities
  capabilities: Pick<CapabilityStore, "set">
  sidebar: Pick<SidebarProvider, "setSearchLoading" | "setSearchResult" | "setSearchError" | "clearSearch">
  showInformationMessage: (message: string) => Thenable<unknown>
  showErrorMessage: (message: string) => Thenable<unknown>
}

type OpenWorkspaceInBrowserInput = {
  runtime: Pick<WorkspaceRuntime, "name" | "state" | "url" | "err"> | undefined
  openExternal: (uri: vscode.Uri) => Thenable<boolean>
  showInformationMessage: (message: string) => Thenable<unknown>
  showErrorMessage: (message: string) => Thenable<unknown>
}

export function buildWorkspaceSearchInputOptions(runtimeName: string, previousQuery?: string): vscode.InputBoxOptions {
  return {
    prompt: `在 ${runtimeName} 中搜索会话`,
    placeHolder: "输入会话标题或关键词",
    ignoreFocusOut: true,
    value: previousQuery,
  }
}

export async function openWorkspaceInBrowser(input: OpenWorkspaceInBrowserInput) {
  if (!input.runtime) {
    await input.showInformationMessage("请选择要在浏览器中打开的工作区。")
    return
  }

  if (input.runtime.state !== "ready") {
    await input.showErrorMessage(runtimeNotReadyMessage(input.runtime))
    return
  }

  await input.openExternal(vscode.Uri.parse(input.runtime.url))
}

export async function runWorkspaceSessionSearch(input: WorkspaceSessionSearchInput) {
  const query = input.query?.trim()
  if (!query) {
    return
  }

  if (input.capability === "unsupported") {
    await input.showInformationMessage(`HyperCode 服务（${input.runtime.name}）不支持会话搜索。`)
    return
  }

  if (input.runtime.state !== "ready" || !input.runtime.sdk) {
    await input.showErrorMessage(runtimeNotReadyMessage(input.runtime))
    return
  }

  input.sidebar.setSearchLoading(input.runtime.workspaceId, query)

  try {
    const result = await input.runtime.sdk.session.list({
      directory: input.runtime.dir,
      roots: true,
      search: query,
    })
    input.sidebar.setSearchResult(input.runtime.workspaceId, query, result.data ?? [])
    input.capabilities.set(
      input.runtime.workspaceId,
      applySessionSearchCapabilityResult(input.snapshot ?? createEmptyCapabilities(), "supported"),
    )
  } catch (error) {
    const state = classifyCapabilityError(error)

    if (state === "unsupported") {
      input.sidebar.clearSearch(input.runtime.workspaceId)
      input.capabilities.set(
        input.runtime.workspaceId,
        applySessionSearchCapabilityResult(input.snapshot ?? createEmptyCapabilities(), "unsupported"),
      )
      await input.showInformationMessage(`HyperCode 服务（${input.runtime.name}）不支持会话搜索。`)
      return
    }

    const message = errorMessage(error)
    input.sidebar.setSearchError(input.runtime.workspaceId, query, message)
    await input.showErrorMessage(`HyperCode 会话搜索失败（${input.runtime.name}）：${message}`)
  }
}

export async function renameSession(input: SessionActionInput & {
  showInputBox: (options: vscode.InputBoxOptions) => Thenable<string | undefined>
}) {
  if (!isSessionActionReady(input.target, input.showErrorMessage)) {
    return
  }

  const label = displaySessionTitle(input.target.session.title, input.target.session.id.slice(0, 8))
  const title = await input.showInputBox({
    prompt: `重命名会话 "${label}"`,
    placeHolder: "会话标题",
    value: input.target.session.title,
    ignoreFocusOut: true,
  })

  const next = title?.trim()
  if (!next || next === input.target.session.title) {
    return
  }

  try {
    await input.target.runtime.sdk!.session.update!({
      sessionID: input.target.session.id,
      directory: input.target.runtime.dir,
      title: next,
    })
    await input.sessions.refresh(input.target.runtime.workspaceId, true)
  } catch (error) {
    await input.showErrorMessage(`HyperCode 重命名失败（${input.target.runtime.name}）：${errorMessage(error)}`)
  }
}

export async function manageSessionTags(input: {
  target: SessionActionTarget
  tags: Pick<SessionTagStore, "tags" | "setTags">
  showInputBox: (options: vscode.InputBoxOptions) => Thenable<string | undefined>
}) {
  const current = input.tags.tags(input.target.runtime.workspaceId, input.target.session.id)
  const value = await input.showInputBox({
    prompt: `管理 ${displaySessionTitle(input.target.session.title, input.target.session.id.slice(0, 8))} 的标签`,
    placeHolder: "标签 A, 标签 B",
    value: current.join(", "),
    ignoreFocusOut: true,
  })

  if (value === undefined) {
    return
  }

  await input.tags.setTags(input.target.runtime.workspaceId, input.target.session.id, parseSessionTagsInput(value))
}

export async function archiveSession(input: SessionActionInput & {
  closeSession?: () => Thenable<unknown> | unknown
  showWarningMessage: (
    message: string,
    options: vscode.MessageOptions,
    ...items: string[]
  ) => Thenable<string | undefined>
  now?: () => number
}) {
  if (!isSessionActionReady(input.target, input.showErrorMessage)) {
    return
  }

  const label = displaySessionTitle(input.target.session.title, input.target.session.id.slice(0, 8))
  const confirmed = await input.showWarningMessage(
    `归档会话 "${label}"？归档后会话将从默认列表中隐藏。`,
    { modal: true },
    "归档会话",
  )

  if (confirmed !== "归档会话") {
    return
  }

  try {
    await input.target.runtime.sdk!.session.update!({
      sessionID: input.target.session.id,
      directory: input.target.runtime.dir,
      time: {
        archived: (input.now ?? Date.now)(),
      },
    })
    await input.sessions.refresh(input.target.runtime.workspaceId, true)
    await input.closeSession?.()
    await input.showInformationMessage(`已归档会话 "${label}"。`)
  } catch (error) {
    await input.showErrorMessage(`HyperCode 归档失败（${input.target.runtime.name}）：${errorMessage(error)}`)
  }
}

export async function shareSession(input: SessionActionInput & {
  copyText: (value: string) => Thenable<void>
}) {
  if (!isSessionActionReady(input.target, input.showErrorMessage)) {
    return
  }

  try {
    const result = await input.target.runtime.sdk!.session.share!({
      sessionID: input.target.session.id,
      directory: input.target.runtime.dir,
    })
    const url = result.data?.share?.url
    if (!url) {
      await input.showErrorMessage(`HyperCode 分享失败（${input.target.runtime.name}）：缺少分享链接。`)
      return
    }

    await input.copyText(url)
    await input.sessions.refresh(input.target.runtime.workspaceId, true)
    await input.showInformationMessage("分享链接已复制到剪贴板。")
  } catch (error) {
    await input.showErrorMessage(`HyperCode 分享失败（${input.target.runtime.name}）：${errorMessage(error)}`)
  }
}

export async function unshareSession(input: SessionActionInput) {
  if (!isSessionActionReady(input.target, input.showErrorMessage)) {
    return
  }

  try {
    await input.target.runtime.sdk!.session.unshare!({
      sessionID: input.target.session.id,
      directory: input.target.runtime.dir,
    })
    await input.sessions.refresh(input.target.runtime.workspaceId, true)
    await input.showInformationMessage("已取消会话分享。")
  } catch (error) {
    await input.showErrorMessage(`HyperCode 取消分享失败（${input.target.runtime.name}）：${errorMessage(error)}`)
  }
}

function firstRuntime(mgr: WorkspaceManager): WorkspaceRuntime | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0]
  return folder ? mgr.get(folder.uri.toString()) : undefined
}

function runtimeFromActiveEditor(mgr: WorkspaceManager): WorkspaceRuntime | undefined {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return undefined
  }

  const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
  if (!folder) {
    return undefined
  }

  return mgr.get(folder.uri.toString())
}

function workspaceRef(runtime: { workspaceId: string; dir: string }): WorkspaceRef {
  return {
    workspaceId: runtime.workspaceId,
    dir: runtime.dir,
  }
}

async function resolveSessionActionTarget(item: SessionItem | undefined, mgr: WorkspaceManager) {
  if (!item) {
    await vscode.window.showInformationMessage("请先选择一个会话项。")
    return undefined
  }

  const rt = mgr.get(item.runtime.workspaceId)
  if (!rt || rt.state !== "ready" || !rt.sdk) {
    await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
    return undefined
  }

  return {
    runtime: rt,
    session: item.session,
  } satisfies SessionActionTarget
}

async function acquireNewSessionTarget(
  rt: WorkspaceRuntime,
  sessions: SessionStore,
  out: vscode.OutputChannel,
) {
  await sessions.refresh(rt.workspaceId, true)

  const currentSessions = sessions.list(rt.workspaceId)
  const emptySessionIds = await loadEmptyNewSessionIds(rt, currentSessions, out)
  const existing = resolveReusableNewSession({
    sessions: currentSessions,
    emptySessionIds,
    statuses: rt.sessionStatuses,
  })

  if (existing.keep) {
    return {
      session: existing.keep,
      stale: existing.stale,
    }
  }

  const created = await sessions.create(rt.workspaceId)
  const refreshed = sessions.list(rt.workspaceId)
  const allSessions = refreshed.some((item) => item.id === created.id)
    ? refreshed
    : [created, ...refreshed]

  const next = resolveReusableNewSession({
    sessions: allSessions,
    emptySessionIds: new Set([...emptySessionIds, created.id]),
    statuses: rt.sessionStatuses,
    preferredSessionId: created.id,
  })

  return {
    session: next.keep ?? created,
    stale: next.stale,
  }
}

async function cleanupStaleNewSessions(
  rt: WorkspaceRuntime,
  stale: SessionInfo[],
  sessions: SessionStore,
  tabs: TabManager,
  out: vscode.OutputChannel,
) {
  for (const session of stale) {
    try {
      await sessions.delete(rt.workspaceId, session.id)
      tabs.closeSession(workspaceRef(rt), session.id)
    } catch (error) {
      out.appendLine(`[commands] failed to remove stale new session ${session.id} for ${rt.name}: ${errorMessage(error)}`)
    }
  }
}

async function loadEmptyNewSessionIds(
  rt: WorkspaceRuntime,
  sessions: SessionInfo[],
  out: vscode.OutputChannel,
) {
  if (!rt.sdk) {
    return new Set<string>()
  }

  const candidates = sessions.filter((session) => isDefaultNewSessionTitle(session.title))
  const checks = await Promise.all(candidates.map(async (session) => {
    const status = rt.sessionStatuses.get(session.id)
    if (status?.type && status.type !== "idle") {
      return undefined
    }

    try {
      const result = await rt.sdk!.session.messages({
        sessionID: session.id,
        directory: rt.dir,
        limit: 1,
      })
      return (result.data?.length ?? 0) === 0 ? session.id : undefined
    } catch (error) {
      out.appendLine(`[commands] failed to inspect session ${session.id} for reuse: ${errorMessage(error)}`)
      return undefined
    }
  }))

  return new Set(checks.filter((sessionId): sessionId is string => !!sessionId))
}

async function openSeededSession(
  seed: LaunchSeed,
  mgr: WorkspaceManager,
  sessions: SessionStore,
  panels: SessionPanelManager,
  capabilities: CapabilityStore,
) {
  const rt = mgr.get(seed.workspaceId)

  if (!rt) {
    await vscode.window.showInformationMessage("请先打开一个工作区文件夹。")
    return
  }

  if (rt.state !== "ready") {
    await vscode.window.showErrorMessage(runtimeNotReadyMessage(rt))
    return
  }

  void capabilities.getOrProbe(rt.workspaceId)
  const target = resolveSeedSessionTarget({
    workspaceId: rt.workspaceId,
    activeSession: panels.activeSession(),
    visibleSession: panels.visibleSession(rt.workspaceId),
    recentSession: panels.recentSession(rt.workspaceId),
  })

  if (target) {
    await panels.openWithSeed(target, seed.parts)
    return
  }

  const session = await sessions.create(rt.workspaceId)
  await panels.openWithSeed({
    workspaceId: rt.workspaceId,
    dir: rt.dir,
    sessionId: session.id,
  }, seed.parts, resolveNewSessionOpenColumn())
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function isSessionActionReady(
  target: SessionActionTarget,
  showErrorMessage: (message: string) => Thenable<unknown>,
) {
  if (target.runtime.state === "ready" && target.runtime.sdk) {
    return true
  }

  void showErrorMessage(runtimeNotReadyMessage(target.runtime as WorkspaceRuntime))
  return false
}

export function resolveSeedSessionTarget(input: {
  workspaceId: string
  activeSession?: WorkspaceRef & { sessionId: string }
  visibleSession?: WorkspaceRef & { sessionId: string }
  recentSession?: WorkspaceRef & { sessionId: string }
}) {
  if (input.activeSession?.workspaceId === input.workspaceId) {
    return input.activeSession
  }

  if (input.visibleSession?.workspaceId === input.workspaceId) {
    return input.visibleSession
  }

  if (input.recentSession?.workspaceId === input.workspaceId) {
    return input.recentSession
  }

  return undefined
}

export function resolveNewSessionOpenColumn() {
  return vscode.ViewColumn.Beside
}

export async function forkSessionMessage(input: {
  runtime: WorkspaceRuntime
  current: WorkspaceRef & { sessionId: string }
  messageID: string
}) {
  const messages = await input.runtime.sdk!.session.messages({
    sessionID: input.current.sessionId,
    directory: input.runtime.dir,
  })

  const message = messages.data?.find((item) => item.info.role === "user" && item.info.id === input.messageID)
  if (!message) {
    return undefined
  }

  return (await input.runtime.sdk!.session.fork({
    sessionID: input.current.sessionId,
    directory: input.runtime.dir,
    messageID: input.messageID,
  })).data
}

export function resolveReusableNewSession(input: {
  sessions: SessionInfo[]
  emptySessionIds: Set<string>
  statuses: Map<string, SessionStatus>
  preferredSessionId?: string
}) {
  const reusable = [...input.sessions]
    .filter((session) => input.emptySessionIds.has(session.id))
    .filter((session) => isDefaultNewSessionTitle(session.title))
    .filter((session) => {
      const status = input.statuses.get(session.id)
      return !status?.type || status.type === "idle"
    })
    .sort((a, b) => b.time.updated - a.time.updated)

  const keep = reusable.find((session) => session.id === input.preferredSessionId) ?? reusable[0]

  return {
    keep,
    stale: keep ? reusable.filter((session) => session.id !== keep.id) : [],
  }
}
