import React from "react"
import type { SessionPickerPayload as SessionPickerPayloadData } from "../../../bridge/types"
import type { SessionInfo } from "../../../core/sdk"

export type SessionPickerItem = {
  session: SessionInfo
  title: string
  shortId: string
  tags: string[]
}

export type SessionPickerSection = {
  id: string
  label: string
  items: SessionPickerItem[]
}

export type SessionPickerView = {
  sections: SessionPickerSection[]
  availableTags: string[]
}

export function buildSessionPickerView(input: {
  sessions: SessionInfo[]
  currentSessionId: string
  query?: string
  tagsBySessionId?: Record<string, string[]>
  now?: number
}): SessionPickerView {
  const tagsBySessionId = input.tagsBySessionId ?? {}
  const baseItems = [...input.sessions]
    .filter((session) => session.id !== input.currentSessionId)
    .sort((a, b) => b.time.updated - a.time.updated)
    .map((session) => {
      const tags = normalizeTags(tagsBySessionId[session.id])
      return {
        session,
        title: displayTitle(session),
        shortId: session.id.slice(0, 8),
        tags,
      } satisfies SessionPickerItem
    })

  const availableTags = [...new Set(baseItems.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b))
  const needle = input.query?.trim().toLowerCase() ?? ""
  const filtered = baseItems.filter((item) => {
    if (!needle) {
      return true
    }

    const haystack = [item.title, item.shortId, item.session.id, ...item.tags].join(" ").toLowerCase()
    return haystack.includes(needle)
  })

  return {
    sections: groupSections(filtered, input.now ?? Date.now()),
    availableTags,
  }
}

export function SessionPicker({
  payload,
  onClose,
  onSwitch,
  now,
}: {
  payload: SessionPickerPayloadData
  onClose: () => void
  onSwitch: (sessionID: string) => void
  now?: number
}) {
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const tagsBySessionId = React.useMemo(
    () => Object.fromEntries(payload.items.map((item) => [item.session.id, item.tags])),
    [payload.items],
  )
  const view = React.useMemo(() => buildSessionPickerView({
    sessions: payload.items.map((item) => item.session),
    currentSessionId: payload.currentSessionId,
    query,
    tagsBySessionId,
    now,
  }), [now, payload.currentSessionId, payload.items, query, tagsBySessionId])
  const flatItems = React.useMemo(() => view.sections.flatMap((section) => section.items), [view.sections])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const activeItem = flatItems[selectedIndex]

  React.useEffect(() => {
    setSelectedIndex((current) => clampIndex(current, flatItems.length))
  }, [flatItems.length])

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    scrollActiveSessionPickerItemIntoView(listRef.current, selectedIndex)
  }, [selectedIndex])

  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "n")) {
      event.preventDefault()
      setSelectedIndex((current) => clampIndex(current + 1, flatItems.length))
      return
    }
    if (event.key === "ArrowUp" || (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "p")) {
      event.preventDefault()
      setSelectedIndex((current) => clampIndex(current - 1, flatItems.length))
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      setSelectedIndex(0)
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      setSelectedIndex(Math.max(0, flatItems.length - 1))
      return
    }
    if (event.key === "Enter" && activeItem) {
      event.preventDefault()
      onSwitch(activeItem.session.id)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
    }
  }, [activeItem, flatItems.length, onClose, onSwitch])

  const emptyTitle = query ? "No matching sessions" : "No workspace sessions"
  const emptyHint = query
    ? "Try a different search."
    : "Start another session in this workspace to see it here."

  return (
    <div className="oc-modelPicker oc-sessionPicker" role="dialog" aria-label="Switch session" onKeyDown={onKeyDown}>
      <div className="oc-modelPickerTop">
        <div className="oc-modelPickerHeader">
          <span className="oc-modelPickerTitle">Switch session</span>
          <span className="oc-modelPickerMeta">{payload.workspaceName || "Current workspace"}</span>
        </div>
        <div className="oc-modelPickerToolbar">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="oc-modelPickerSearch"
            placeholder="Filter sessions"
            aria-label="Filter sessions"
          />
        </div>
      </div>
      <div className="oc-modelPickerSections" ref={listRef}>
        {view.sections.length > 0 ? renderSections(view.sections, selectedIndex, setSelectedIndex, onSwitch) : (
          <div className="oc-modelPickerSection">
            <div className="oc-modelPickerEmptyText">{emptyTitle}</div>
            <div className="oc-modelPickerItemHint">{emptyHint}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function renderSections(
  sections: SessionPickerSection[],
  selectedIndex: number,
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>,
  onSwitch: (sessionID: string) => void,
) {
  let flatIndex = -1

  return sections.map((section) => (
    <div key={section.id} className="oc-modelPickerSection">
      <div className="oc-modelPickerSectionTitle">{section.label}</div>
      <div className="oc-modelPickerList">
        {section.items.map((item) => {
          flatIndex += 1
          const currentIndex = flatIndex
          const active = currentIndex === selectedIndex
          return (
            <div
              key={item.session.id}
              role="button"
              tabIndex={-1}
              data-session-index={currentIndex}
              className={`oc-modelPickerItem${active ? " is-active" : ""}`}
              onMouseEnter={() => setSelectedIndex(currentIndex)}
              onClick={() => onSwitch(item.session.id)}
            >
              <span className="oc-modelPickerItemMain">
                <span className="oc-modelPickerItemIdentity">
                  <span className="oc-modelPickerItemLabel">{item.title}</span>
                  <span className="oc-modelPickerItemDetail">{item.shortId}</span>
                  {item.tags.length > 0 ? <span className="oc-modelPickerItemDetail">{item.tags.map((tag) => `#${tag}`).join(" ")}</span> : null}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  ))
}

export function scrollActiveSessionPickerItemIntoView(
  root: { querySelector(selectors: string): { scrollIntoView(options?: ScrollIntoViewOptions): void } | null } | null,
  selectedIndex: number,
) {
  if (!root) {
    return
  }

  const node = root.querySelector(`[data-session-index="${selectedIndex}"]`)
  node?.scrollIntoView({ block: "nearest" })
}

function groupSections(items: SessionPickerItem[], now: number): SessionPickerSection[] {
  const groups = new Map<string, SessionPickerItem[]>()

  for (const item of items) {
    const label = dayLabel(item.session.time.updated, now)
    const list = groups.get(label) ?? []
    list.push(item)
    groups.set(label, list)
  }

  return [...groups.entries()].map(([label, groupItems]) => ({
    id: label,
    label,
    items: groupItems,
  }))
}

function dayLabel(timestamp: number, now: number) {
  const diff = dayDiff(timestamp, now)
  if (diff === 0) {
    return "Today"
  }
  if (diff === 1) {
    return "Yesterday"
  }
  return localDateKey(timestamp)
}

function dayDiff(timestamp: number, now: number) {
  const target = startOfDay(timestamp)
  const current = startOfDay(now)
  return Math.round((current - target) / 86400000)
}

function startOfDay(value: number) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function localDateKey(value: number) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function displayTitle(session: SessionInfo) {
  const title = session.title?.trim()
  return title || session.id.slice(0, 8)
}

function normalizeTags(tags: string[] | undefined) {
  return Array.isArray(tags)
    ? tags.map((tag) => tag.trim()).filter(Boolean)
    : []
}

function clampIndex(index: number, size: number) {
  if (size <= 0) {
    return 0
  }
  if (index < 0) {
    return 0
  }
  if (index >= size) {
    return size - 1
  }
  return index
}
