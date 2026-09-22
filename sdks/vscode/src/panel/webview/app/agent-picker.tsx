import React from "react"
import type { AgentInfo } from "../../../core/sdk"
import { t } from "../../../i18n"

export type AgentPickerItem = {
  agent: AgentInfo
  group: "primary" | "subagent"
  label: string
  detail: string
  selected: boolean
}

export function buildAgentPickerItems(agents: AgentInfo[], currentAgent?: string): AgentPickerItem[] {
  return agents
    .filter((agent) => !agent.hidden)
    .map((agent) => ({
      agent,
      group: agent.mode === "subagent" ? "subagent" as const : "primary" as const,
      label: agent.name,
      detail: agentDescription(agent),
      selected: agent.mode !== "subagent" && agent.name === currentAgent,
    }))
}

export function AgentPicker({
  items,
  onClose,
  onSelect,
}: {
  items: AgentPickerItem[]
  onClose: () => void
  onSelect: (item: AgentPickerItem) => void
}) {
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const filteredItems = React.useMemo(() => filterAgentPickerItems(items, query), [items, query])
  const [selectedIndex, setSelectedIndex] = React.useState(() => Math.max(0, filteredItems.findIndex((item) => item.selected)))
  const activeItem = filteredItems[selectedIndex]

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    setSelectedIndex((current) => filteredItems.length === 0 ? 0 : Math.min(current, filteredItems.length - 1))
  }, [filteredItems])

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-agent-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  const move = React.useCallback((delta: number) => {
    setSelectedIndex((current) => {
      if (filteredItems.length === 0) return 0
      return (current + delta + filteredItems.length) % filteredItems.length
    })
  }, [filteredItems.length])

  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      move(1)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      move(-1)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      if (activeItem) onSelect(activeItem)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
    }
  }, [activeItem, move, onClose, onSelect])

  const sections = [
    {
      group: "primary" as const,
      label: t("agent.group.primary"),
      items: filteredItems.filter((item) => item.group === "primary"),
    },
    {
      group: "subagent" as const,
      label: t("agent.group.subagents"),
      items: filteredItems.filter((item) => item.group === "subagent"),
    },
  ].filter((section) => section.items.length > 0)

  return (
    <div className="oc-modelPicker" role="dialog" aria-label={t("agent.picker.title")} onKeyDown={onKeyDown}>
      <div className="oc-modelPickerTop">
        <div className="oc-modelPickerHeader">
          <span className="oc-modelPickerTitle">{t("agent.picker.title")}</span>
          <span className="oc-modelPickerMeta">{t("agent.picker.meta")}</span>
        </div>
        <div className="oc-modelPickerToolbar">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="oc-modelPickerSearch"
            placeholder={t("agent.picker.filter")}
            aria-label={t("agent.picker.filter")}
          />
        </div>
      </div>
      <div className="oc-modelPickerSections" ref={listRef}>
        {sections.length > 0 ? sections.map((section) => (
          <div key={section.group} className="oc-modelPickerSection">
            <div className="oc-modelPickerSectionTitle">{section.label}</div>
            <div className="oc-modelPickerList">
              {section.items.map((item) => {
                const index = filteredItems.indexOf(item)
                return (
                  <div
                    key={item.agent.name}
                    role="button"
                    tabIndex={-1}
                    data-agent-index={index}
                    className={`oc-modelPickerItem${item.selected ? " is-selected" : ""}${index === selectedIndex ? " is-active" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => onSelect(item)}
                  >
                    <span className="oc-modelPickerItemMain">
                      <span className="oc-modelPickerItemIdentity oc-agentPickerIdentity">
                        <span className="oc-modelPickerItemLabel">{item.label}</span>
                        <span className="oc-modelPickerItemDetail" title={item.detail}>{item.detail}</span>
                      </span>
                      <span className="oc-modelPickerItemKind">{item.group === "primary" ? t("agent.picker.switch") : t("agent.picker.invoke")}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )) : <div className="oc-modelPickerEmptyText">{t("agent.picker.empty")}</div>}
      </div>
    </div>
  )
}

function filterAgentPickerItems(items: AgentPickerItem[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => `${item.label} ${item.detail} ${item.group}`.toLowerCase().includes(needle))
}

function agentDescription(agent: AgentInfo) {
  const builtIn = {
    build: t("agent.description.build"),
    plan: t("agent.description.plan"),
    general: t("agent.description.general"),
    explore: t("agent.description.explore"),
  }[agent.name]

  return builtIn || agent.description?.trim() || t("agent.description.missing")
}
