import * as vscode from "vscode"
import type { SessionInfo, SessionStatus } from "../core/sdk"
import type { WorkspaceRuntime } from "../core/server"
import { isMissingOpencodeError, missingOpencodeMessage } from "../core/runtime-errors"
import { SessionTagStore } from "../core/session-tags"
import { SessionStore } from "../core/session"
import { WorkspaceManager } from "../core/workspace"
import { ClearSearchItem, ClearTagFilterItem, SessionItem, StatusItem, WorkspaceItem } from "./item"

export type WorkspaceSearchState = {
  query: string
  status: "loading" | "ready" | "error"
  results: SessionInfo[]
  error?: string
}

type WorkspaceChildrenInput = {
  runtime: Pick<WorkspaceRuntime, "workspaceId" | "dir" | "name" | "state" | "sessionsState" | "sessionsErr" | "sessionStatuses" | "err" | "url" | "port">
  sessions: SessionInfo[]
  statuses: Map<string, SessionStatus>
  search?: WorkspaceSearchState
  tagFilter?: string
  tags?: Record<string, string[]>
}

export function setWorkspaceSearchLoading(
  state: Map<string, WorkspaceSearchState>,
  workspaceId: string,
  query: string,
) {
  state.set(workspaceId, {
    query,
    status: "loading",
    results: [],
  })
}

export function setWorkspaceSearchResult(
  state: Map<string, WorkspaceSearchState>,
  workspaceId: string,
  query: string,
  results: SessionInfo[],
) {
  state.set(workspaceId, {
    query,
    status: "ready",
    results,
  })
}

export function setWorkspaceSearchError(
  state: Map<string, WorkspaceSearchState>,
  workspaceId: string,
  query: string,
  error: string,
) {
  state.set(workspaceId, {
    query,
    status: "error",
    results: [],
    error,
  })
}

export function clearWorkspaceSearchState(
  state: Map<string, WorkspaceSearchState>,
  workspaceId: string,
) {
  state.delete(workspaceId)
}

export function getWorkspaceSearchQuery(
  state: Map<string, WorkspaceSearchState>,
  workspaceId: string,
) {
  return state.get(workspaceId)?.query
}

export function getWorkspaceTagFilter(
  state: Map<string, string>,
  workspaceId: string,
) {
  return state.get(workspaceId)
}

export function buildWorkspaceChildren(input: WorkspaceChildrenInput) {
  if (input.runtime.state === "starting") {
    return [new StatusItem(`正在启动服务：${input.runtime.url}`)]
  }

  if (input.runtime.state === "error") {
    if (isMissingOpencodeError(input.runtime.err)) {
      return [new StatusItem("HyperCode 运行时不可用", missingOpencodeMessage(input.runtime))]
    }

    return [new StatusItem(input.runtime.err ? `错误：${input.runtime.err}` : "服务启动失败")]
  }

  if (input.runtime.state !== "ready") {
    return [new StatusItem("服务已停止")]
  }

  if (input.runtime.sessionsState === "loading" && !input.sessions.length && !input.search) {
    return [new StatusItem("正在加载会话...")]
  }

  if (input.search?.status === "loading") {
    return [
      new ClearSearchItem(input.runtime),
      ...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []),
      new StatusItem("正在搜索会话..."),
    ]
  }

  if (input.search?.status === "error") {
    return [
      new ClearSearchItem(input.runtime),
      ...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []),
      new StatusItem(`搜索错误：${input.search.error || "未知错误"}`),
    ]
  }

  if (input.search) {
    const list = filteredSessions(input.search.results, input.tagFilter, input.tags)
      .map((session) => new SessionItem(input.runtime, session, input.statuses.get(session.id), input.tags?.[session.id] ?? []))
    return list.length
      ? [new ClearSearchItem(input.runtime), ...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []), ...list]
      : [new ClearSearchItem(input.runtime), ...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []), new StatusItem("没有匹配的会话")]
  }

  const list = filteredSessions(input.sessions, input.tagFilter, input.tags)
    .map((session) => new SessionItem(input.runtime, session, input.statuses.get(session.id), input.tags?.[session.id] ?? []))

  if (input.runtime.sessionsErr) {
    return [...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []), new StatusItem(`会话错误：${input.runtime.sessionsErr}`), ...list]
  }

  if (list.length) {
    return [...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []), ...list]
  }

  return [...(input.tagFilter ? [new ClearTagFilterItem(input.runtime, input.tagFilter)] : []), new StatusItem("暂无会话")]
}

export class SidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private change = new vscode.EventEmitter<void>()
  private search = new Map<string, WorkspaceSearchState>()
  private tagFilters = new Map<string, string>()

  readonly onDidChangeTreeData = this.change.event

  constructor(
    private mgr: WorkspaceManager,
    private sessions: SessionStore,
    private tags: SessionTagStore,
  ) {
    this.mgr.onDidChange(() => {
      this.refresh()
    })
  }

  refresh() {
    this.change.fire()
  }

  getTreeItem(item: vscode.TreeItem) {
    return item
  }

  getParent(item: vscode.TreeItem) {
    if (!(item instanceof SessionItem)) {
      return undefined
    }

    const rt = this.mgr.get(item.runtime.workspaceId)
    if (!rt) {
      return undefined
    }

    return new WorkspaceItem(rt, this.search.has(rt.workspaceId), this.tagFilters.has(rt.workspaceId))
  }

  getChildren(item?: vscode.TreeItem) {
    if (!item) {
      const list = this.mgr.list()

      if (list.length) {
        return list.map((rt) => new WorkspaceItem(rt, this.search.has(rt.workspaceId), this.tagFilters.has(rt.workspaceId)))
      }

      return [new StatusItem("未打开工作区文件夹")]
    }

    if (item instanceof WorkspaceItem) {
      const rt = this.mgr.get(item.runtime.workspaceId) ?? item.runtime
      return buildWorkspaceChildren({
        runtime: rt,
        sessions: this.sessions.list(rt.workspaceId),
        statuses: rt.sessionStatuses,
        search: this.search.get(rt.workspaceId),
        tagFilter: this.tagFilters.get(rt.workspaceId),
        tags: this.tags.tagsBySession(rt.workspaceId),
      })
    }

    return []
  }

  findSessionItem(workspaceId: string, sessionId: string) {
    const rt = this.mgr.get(workspaceId)
    if (!rt) {
      return undefined
    }

    const items = buildWorkspaceChildren({
      runtime: rt,
      sessions: this.sessions.list(rt.workspaceId),
      statuses: rt.sessionStatuses,
      search: this.search.get(rt.workspaceId),
      tagFilter: this.tagFilters.get(rt.workspaceId),
      tags: this.tags.tagsBySession(rt.workspaceId),
    })

    return items.find((item) => item instanceof SessionItem && item.session.id === sessionId)
  }

  setSearchLoading(workspaceId: string, query: string) {
    setWorkspaceSearchLoading(this.search, workspaceId, query)
    this.refresh()
  }

  setSearchResult(workspaceId: string, query: string, results: SessionInfo[]) {
    setWorkspaceSearchResult(this.search, workspaceId, query, results)
    this.refresh()
  }

  setSearchError(workspaceId: string, query: string, error: string) {
    setWorkspaceSearchError(this.search, workspaceId, query, error)
    this.refresh()
  }

  clearSearch(workspaceId: string) {
    clearWorkspaceSearchState(this.search, workspaceId)
    this.refresh()
  }

  searchQuery(workspaceId: string) {
    return getWorkspaceSearchQuery(this.search, workspaceId)
  }

  filterByTag(workspaceId: string, tag: string) {
    this.tagFilters.set(workspaceId, tag)
    this.refresh()
  }

  clearTagFilter(workspaceId: string) {
    this.tagFilters.delete(workspaceId)
    this.refresh()
  }

  tagFilter(workspaceId: string) {
    return getWorkspaceTagFilter(this.tagFilters, workspaceId)
  }

  dispose() {
    this.change.dispose()
  }
}

function filteredSessions(
  sessions: SessionInfo[],
  tagFilter?: string,
  tags?: Record<string, string[]>,
) {
  if (!tagFilter) {
    return sessions
  }

  return sessions.filter((session) => (tags?.[session.id] ?? []).includes(tagFilter))
}
