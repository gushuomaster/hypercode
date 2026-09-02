import React from "react"
import type { AgentInfo } from "../../../core/sdk"

export type AgentPickerItem = {
  agent: AgentInfo
  group: "primary" | "subagent"
  label: string
  detail: string
  selected: boolean
}

export function buildAgentPickerItems(agents: AgentInfo[], currentAgent?: string, locale = browserLocale()): AgentPickerItem[] {
  return agents
    .filter((agent) => !agent.hidden)
    .map((agent) => ({
      agent,
      group: agent.mode === "subagent" ? "subagent" as const : "primary" as const,
      label: agent.name,
      detail: agentDescription(agent, locale),
      selected: agent.mode !== "subagent" && agent.name === currentAgent,
    }))
}

export function AgentPicker({
  items,
  locale = browserLocale(),
  onClose,
  onSelect,
}: {
  items: AgentPickerItem[]
  locale?: string
  onClose: () => void
  onSelect: (item: AgentPickerItem) => void
}) {
  const chinese = isChinese(locale)
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
      label: chinese ? "主智能体" : "Primary agents",
      items: filteredItems.filter((item) => item.group === "primary"),
    },
    {
      group: "subagent" as const,
      label: chinese ? "子智能体" : "Subagents",
      items: filteredItems.filter((item) => item.group === "subagent"),
    },
  ].filter((section) => section.items.length > 0)

  return (
    <div className="oc-modelPicker" role="dialog" aria-label={chinese ? "选择或调用智能体" : "Select or invoke agent"} onKeyDown={onKeyDown}>
      <div className="oc-modelPickerTop">
        <div className="oc-modelPickerHeader">
          <span className="oc-modelPickerTitle">{chinese ? "选择或调用智能体" : "Select or invoke agent"}</span>
          <span className="oc-modelPickerMeta">{chinese ? "主智能体 / 子智能体" : "Primary / Subagent"}</span>
        </div>
        <div className="oc-modelPickerToolbar">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="oc-modelPickerSearch"
            placeholder={chinese ? "筛选智能体" : "Filter agents"}
            aria-label={chinese ? "筛选智能体" : "Filter agents"}
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
                      <span className="oc-modelPickerItemKind">{item.group === "primary" ? (chinese ? "切换" : "Switch") : (chinese ? "调用" : "Invoke")}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )) : <div className="oc-modelPickerEmptyText">{chinese ? "没有匹配的智能体。" : "No agents match."}</div>}
      </div>
    </div>
  )
}

function filterAgentPickerItems(items: AgentPickerItem[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => `${item.label} ${item.detail} ${item.group}`.toLowerCase().includes(needle))
}

function agentDescription(agent: AgentInfo, locale: string) {
  const chinese = isChinese(locale)
  const builtIn = {
    build: chinese ? "默认开发智能体，负责实现、修改和验证代码。" : "Default development agent for implementing, modifying, and verifying code.",
    plan: chinese ? "规划智能体，负责分析需求并制定实施方案。" : "Planning agent for analyzing requirements and preparing implementation plans.",
    general: chinese ? "通用子智能体，处理复杂研究和多步骤任务。" : "General-purpose subagent for complex research and multi-step tasks.",
    explore: chinese ? "探索子智能体，快速检索和理解代码库。" : "Exploration subagent for quickly searching and understanding the codebase.",
  }[agent.name]

  return builtIn || agent.description?.trim() || (chinese ? "未配置职责说明。" : "No role description configured.")
}

function browserLocale() {
  return typeof navigator === "undefined" ? "en" : navigator.language
}

function isChinese(locale: string) {
  return locale.toLowerCase().startsWith("zh")
}
