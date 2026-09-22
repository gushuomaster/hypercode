import React from "react"
import { createRoot } from "react-dom/client"
import type { SidebarHostMessage, SidebarSubagent, SidebarViewMode, SidebarViewState, SidebarWebviewMessage, TaskFilter } from "../view-types"
import type { SessionPanelRef } from "../../bridge/types"
import type { Todo } from "../../core/sdk"
import { setLocale, t } from "../../i18n"
import "./styles.css"

declare global {
  interface Window {
    __OPENCODE_SIDEBAR_MODE__?: SidebarViewMode
  }
}

type VsCodeApi = {
  postMessage(message: SidebarWebviewMessage): void
}

type SubagentFilter = "all" | "in_progress" | "done"

type GlobalWithVsCodeApi = typeof globalThis & {
  acquireVsCodeApi?: () => VsCodeApi
}

const vscodeGlobal = globalThis as GlobalWithVsCodeApi

if (typeof document !== "undefined") {
  setLocale(document.documentElement.lang)
}

const vscode: VsCodeApi = typeof vscodeGlobal.acquireVsCodeApi === "function"
  ? vscodeGlobal.acquireVsCodeApi()
  : { postMessage() {} }
const mode = typeof window !== "undefined" && window.__OPENCODE_SIDEBAR_MODE__ === "diff"
  ? "diff"
  : typeof window !== "undefined" && window.__OPENCODE_SIDEBAR_MODE__ === "subagents"
    ? "subagents"
    : "todo"

const initialState: SidebarViewState = {
  status: "idle",
  mode,
  todos: [],
  diff: [],
  subagents: [],
}

function App() {
  const [state, setState] = React.useState<SidebarViewState>(initialState)

  React.useEffect(() => {
    const handler = (event: MessageEvent<SidebarHostMessage>) => {
      if (event.data?.type === "state") {
        setState(event.data.payload)
      }
    }

    window.addEventListener("message", handler)
    vscode.postMessage({ type: "ready" })
    return () => window.removeEventListener("message", handler)
  }, [])

  return (
    <div className="sv-shell">
      {state.status === "idle" ? <Empty title={t("sideview.noSelection")} text={idleText(mode)} /> : null}
      {state.status === "loading" ? <Empty title={loadingTitle(mode)} text={t("sideview.fromSelection")} /> : null}
      {state.status === "error" ? <Empty title={t("sideview.unavailable")} text={state.error || t("sideview.loadFailed")} /> : null}
      {state.status === "ready" && mode === "todo" ? <TodoList state={state} /> : null}
      {state.status === "ready" && mode === "diff" ? <DiffList state={state} /> : null}
      {state.status === "ready" && mode === "subagents" ? <SubagentsList state={state} /> : null}
    </div>
  )
}

export function TodoList({ state }: { state: SidebarViewState }) {
  const [filter, setFilter] = React.useState<TaskFilter>("all")
  const view = buildTaskPanelView({
    todos: state.todos,
    filter,
  })

  if (state.todos.length === 0) {
    return <Empty title={t("sideview.todo.empty")} text={t("sideview.todo.emptyText")} />
  }

  return (
    <section className="sv-group">
      <div className="sv-taskSummary">
        <div className="sv-taskSummaryCounts">
          <span>{t("sideview.summary.total", { count: view.summary.total })}</span>
          <span>{t("sideview.summary.open", { count: view.summary.open })}</span>
          <span>{t("sideview.summary.inProgress", { count: view.summary.inProgress })}</span>
          <span>{t("sideview.summary.completed", { count: view.summary.completed })}</span>
        </div>
        <div className="sv-taskFilters" role="tablist" aria-label={t("sideview.todo.filter")}>
          {(["all", "open", "completed"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`sv-taskFilter${filter === item ? " is-active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {taskFilterLabel(item)}
            </button>
          ))}
        </div>
      </div>
      {view.sections.length === 0 ? <Empty title={t("sideview.todo.noMatch")} text={t("sideview.filterHint")} /> : null}
      {view.sections.map((section) => (
        <div key={section.id} className="sv-taskSection">
          <div className="sv-taskSectionTitle">{section.label}</div>
          <div className="sv-list">
            {section.items.map((item, index) => (
              <button
                key={`${section.id}-${item.content}-${index}`}
                type="button"
                className={`sv-todo sv-todo-${item.status}${state.sessionRef ? " is-clickable" : ""}`}
                onClick={() => {
                  const message = buildTaskOpenMessage(state.sessionRef)
                  if (message) {
                    vscode.postMessage(message)
                  }
                }}
                disabled={!state.sessionRef}
              >
                <span className="sv-todoPrefix">{todoPrefix(item.status)}</span>
                <span className="sv-todoBody">
                  <span className="sv-todoText">{item.content || t("sideview.todo.unnamed")}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function DiffList({ state }: { state: SidebarViewState }) {
  const view = buildDiffPanelView({
    branch: state.branch,
    diff: state.diff,
  })

  if (view.items.length === 0) {
    return <Empty title={t("sideview.diff.empty")} text={t("sideview.diff.emptyText")} />
  }

  return (
    <section className="sv-group">
      {view.summary ? (
        <div className="sv-taskSummary">
          <div className="sv-taskSummaryCounts">
            {view.summary.branch ? <span>{view.summary.branch}</span> : null}
            <span>{t("sideview.diff.added", { count: view.summary.counts.added })}</span>
            <span>{t("sideview.diff.modified", { count: view.summary.counts.modified })}</span>
            <span>{t("sideview.diff.deleted", { count: view.summary.counts.deleted })}</span>
          </div>
        </div>
      ) : null}
      <div className="sv-list">
        {view.items.map((item) => (
          <button key={item.file} type="button" className="sv-diff" onClick={() => vscode.postMessage({ type: "openFile", filePath: item.file })}>
            <span className="sv-add">{item.additions ? `+${item.additions}` : ""}</span>
            <span className="sv-sep">/</span>
            <span className="sv-del">{item.deletions ? `-${item.deletions}` : ""}</span>
            <span className="sv-diffPath" title={item.file}>{item.file}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function SubagentsList({ state }: { state: SidebarViewState }) {
  const [filter, setFilter] = React.useState<SubagentFilter>("all")
  const view = buildSubagentPanelView({
    filter,
    subagents: state.subagents,
  })

  if (state.subagents.length === 0) {
    return <Empty title={t("sideview.subagents.empty")} text={t("sideview.subagents.emptyText")} />
  }

  return (
    <section className="sv-group">
      <div className="sv-taskSummary">
        <div className="sv-taskSummaryCounts">
          <span>{t("sideview.summary.total", { count: view.summary.total })}</span>
          <span>{t("sideview.summary.inProgress", { count: view.summary.inProgress })}</span>
          <span>{t("sideview.summary.completed", { count: view.summary.done })}</span>
        </div>
        <div className="sv-taskFilters" role="tablist" aria-label={t("sideview.subagents.filter")}>
          {(["all", "in_progress", "done"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`sv-taskFilter${filter === item ? " is-active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {subagentFilterLabel(item)}
            </button>
          ))}
        </div>
      </div>
      {view.items.length === 0 ? <Empty title={t("sideview.subagents.noMatch")} text={t("sideview.filterHint")} /> : null}
      <div className="sv-list">
        {view.items.map((item) => <SubagentRow key={item.session.id} state={state} item={item} />)}
      </div>
    </section>
  )
}

function SubagentRow({ state, item }: { state: SidebarViewState; item: SidebarSubagent }) {
  const message = buildSubagentOpenMessage(state.sessionRef, item.session.id)

  return (
    <button
      type="button"
      className={`sv-subagent sv-subagent-${item.status.type}${message ? " is-clickable" : ""}`}
      onClick={() => {
        if (message) {
          vscode.postMessage(message)
        }
      }}
      disabled={!message}
    >
      <span className="sv-subagentPrefix">{subagentPrefix(item.status.type)}</span>
      <span className="sv-subagentBody">
        <span className="sv-subagentTitle">{item.session.title || item.session.id}</span>
        {item.activity ? <span className="sv-subagentActivity">{item.activity}</span> : null}
      </span>
    </button>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="sv-empty">
      <div className="sv-emptyTitle">{title}</div>
      <div className="sv-emptyText">{text}</div>
    </div>
  )
}

function todoPrefix(status: string) {
  if (status === "in_progress") {
    return "[~]"
  }
  if (status === "completed") {
    return "[x]"
  }
  return "[ ]"
}

export function buildTaskPanelView(input: {
  todos: Todo[]
  filter?: TaskFilter
}) {
  const filter = input.filter ?? "all"
  const filtered = input.todos.filter((item) => {
    if (filter === "open") {
      return item.status !== "completed"
    }

    if (filter === "completed") {
      return item.status === "completed"
    }

    return true
  })

  const grouped = new Map<string, Todo[]>()
  for (const item of filtered) {
    const key = normalizedTaskStatus(item.status)
    const list = grouped.get(key) ?? []
    list.push(item)
    grouped.set(key, list)
  }

  const sections = taskStatusOrder
    .filter((status) => grouped.has(status))
    .map((status) => ({
      id: status,
      label: taskStatusLabel(status),
      items: grouped.get(status) ?? [],
    }))

  return {
    summary: {
      total: input.todos.length,
      open: input.todos.filter((item) => normalizedTaskStatus(item.status) !== "completed").length,
      completed: input.todos.filter((item) => normalizedTaskStatus(item.status) === "completed").length,
      inProgress: input.todos.filter((item) => normalizedTaskStatus(item.status) === "in_progress").length,
    },
    sections,
  }
}

export function buildTaskOpenMessage(ref?: SessionPanelRef): SidebarWebviewMessage | undefined {
  if (!ref) {
    return undefined
  }

  return {
    type: "openSession",
    workspaceId: ref.workspaceId,
    dir: ref.dir,
    sessionId: ref.sessionId,
  }
}

export function buildDiffPanelView(input: {
  branch?: string
  diff: SidebarViewState["diff"]
}) {
  const counts = input.diff.reduce((summary, item) => {
    if (item.status === "added") {
      summary.added += 1
    } else if (item.status === "deleted") {
      summary.deleted += 1
    } else {
      summary.modified += 1
    }
    return summary
  }, {
    added: 0,
    deleted: 0,
    modified: 0,
  })

  return {
    summary: input.diff.length > 0 ? {
      branch: input.branch,
      counts,
    } : undefined,
    items: input.diff,
  }
}

export function buildSubagentPanelView(input: {
  filter?: SubagentFilter
  subagents: SidebarSubagent[]
}) {
  const filter = input.filter ?? "all"
  const sorted = [...input.subagents].sort((a, b) => {
    const statusCmp = subagentStatusRank(a.status.type) - subagentStatusRank(b.status.type)
    if (statusCmp !== 0) {
      return statusCmp
    }
    return b.session.time.updated - a.session.time.updated
  })
  const items = sorted.filter((item) => {
    if (filter === "in_progress") {
      return item.status.type === "busy" || item.status.type === "retry"
    }

    if (filter === "done") {
      return item.status.type === "idle"
    }

    return true
  })

  return {
    summary: {
      total: input.subagents.length,
      inProgress: input.subagents.filter((item) => item.status.type === "busy" || item.status.type === "retry").length,
      done: input.subagents.filter((item) => item.status.type === "idle").length,
    },
    items,
  }
}

export function buildSubagentOpenMessage(ref: SessionPanelRef | undefined, sessionId: string): SidebarWebviewMessage | undefined {
  if (!ref) {
    return undefined
  }

  return {
    type: "openSession",
    workspaceId: ref.workspaceId,
    dir: ref.dir,
    sessionId,
  }
}

const taskStatusOrder = ["in_progress", "pending", "completed"] as const

function taskStatusLabel(status: string) {
  if (status === "in_progress") {
    return t("sideview.status.inProgress")
  }

  if (status === "completed") {
    return t("sideview.status.completed")
  }

  return t("sideview.status.open")
}

function taskFilterLabel(filter: TaskFilter) {
  if (filter === "open") {
    return t("sideview.status.open")
  }

  if (filter === "completed") {
    return t("sideview.status.completed")
  }

  return t("sideview.filter.all")
}

function subagentPrefix(status: SidebarSubagent["status"]["type"]) {
  if (status === "busy") {
    return "[~]"
  }

  if (status === "retry") {
    return "[!]"
  }

  return "[x]"
}

function subagentStatusRank(status: SidebarSubagent["status"]["type"]) {
  if (status === "busy" || status === "retry") {
    return 0
  }

  return 1
}

function subagentFilterLabel(filter: SubagentFilter) {
  if (filter === "in_progress") {
    return t("sideview.status.inProgress")
  }

  if (filter === "done") {
    return t("sideview.status.completed")
  }

  return t("sideview.filter.all")
}

function idleText(mode: SidebarViewMode) {
  if (mode === "diff") {
    return t("sideview.idle.diff")
  }

  if (mode === "subagents") {
    return t("sideview.idle.subagents")
  }

  return t("sideview.idle.todo")
}

function loadingTitle(mode: SidebarViewMode) {
  if (mode === "diff") {
    return t("sideview.loading.diff")
  }

  if (mode === "subagents") {
    return t("sideview.loading.subagents")
  }

  return t("sideview.loading.todo")
}

function normalizedTaskStatus(status: string) {
  if (status === "in_progress" || status === "completed") {
    return status
  }

  return "pending"
}

if (typeof document !== "undefined") {
  const root = document.getElementById("root")
  if (root) {
    createRoot(root).render(<App />)
  }
}
