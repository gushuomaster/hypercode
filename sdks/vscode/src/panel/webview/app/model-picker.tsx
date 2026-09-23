import React from "react"
import { deriveModelCatalog, productTextKeyForModelSection, type ProductModelItem, type ProductModelSection, type ProductProviderAction, type ProductProviderState } from "@opencode-ai/product"
import type { ProviderInfo } from "../../../core/sdk"
import type { ComposerModelRef } from "./state"
import { t } from "../../../i18n"
import { toProductProviders } from "../lib/product-adapter"
import { toVsCodeTextKey } from "../lib/product-text-adapter"

export type ModelPickerItem = {
  id: string
  providerLabel: string
  modelLabel: string
  model: ComposerModelRef
  selected: boolean
  favorite: boolean
  variant?: string
  variantOptions: string[]
}

export type ModelPickerSection = {
  id: string
  label: string
  items: ModelPickerItem[]
  collapsedCount?: number
}

export type ModelPickerCatalog = {
  sections: ModelPickerSection[]
  searchItems: ModelPickerItem[]
}

export type ModelPickerRecoveryAction = {
  providerID: string
  label: string
  actionLabel: string
  action: ProductProviderAction
}

type FilteredModelPickerSection = ModelPickerSection & {
  items: ModelPickerItem[]
}

export function buildModelPickerSections({
  providers,
  favorites,
  recents,
  currentModel,
  variants,
}: {
  providers: ProviderInfo[]
  favorites: ComposerModelRef[]
  recents: ComposerModelRef[]
  currentModel?: ComposerModelRef
  variants?: Record<string, string>
}): ModelPickerSection[] {
  return buildModelPickerCatalog({ providers, favorites, recents, currentModel, variants }).sections
}

export function buildModelPickerCatalog({
  providers,
  favorites,
  recents,
  configured = [],
  currentModel,
  variants,
}: {
  providers: ProviderInfo[]
  favorites: ComposerModelRef[]
  recents: ComposerModelRef[]
  configured?: ComposerModelRef[]
  currentModel?: ComposerModelRef
  variants?: Record<string, string>
}): ModelPickerCatalog {
  const catalog = deriveModelCatalog({
    providers: toProductProviders(providers),
    favorites,
    recents,
    configured,
    current: currentModel,
    variants,
  })
  return {
    sections: catalog.sections.map(toModelPickerSection),
    searchItems: catalog.searchItems.map(toModelPickerItem),
  }
}

export function buildModelPickerRecoveryActions({
  providerStates,
}: {
  providerStates: ProductProviderState[]
}): ModelPickerRecoveryAction[] {
  return providerStates.flatMap((state) => {
    if (state.recovery === "none") return []
    const label = state.displayName || state.providerID
    const action = state.recovery === "connect"
      ? { type: "provider.connect", providerID: state.providerID } as const
      : state.recovery === "open_docs"
        ? { type: "provider.openDocs", providerID: state.providerID } as const
        : { type: "provider.retry", providerID: state.providerID } as const
    return [{
      providerID: state.providerID,
      label,
      actionLabel: state.recovery === "open_docs" ? t("model.openDocs") : t("model.connect", { provider: label }),
      action,
    }]
  })
}

export function ModelPicker({
  sections,
  searchItems,
  recoveryActions = [],
  currentAgent,
  onClose,
  onOpenProviderDocs,
  onProviderRecovery,
  onSelect,
  onToggleFavorite,
  onCycleVariant,
}: {
  sections: ModelPickerSection[]
  searchItems?: ModelPickerItem[]
  recoveryActions?: ModelPickerRecoveryAction[]
  currentAgent?: string
  onClose: () => void
  onOpenProviderDocs: () => void
  onProviderRecovery?: (action: ProductProviderAction) => void
  onSelect: (model: ComposerModelRef) => void
  onToggleFavorite: (model: ComposerModelRef) => void
  onCycleVariant: (model: ComposerModelRef) => void
}) {
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const filteredSections = React.useMemo(() => filterModelPickerSections(sections, searchItems ?? sections.flatMap((section) => section.items), query), [query, searchItems, sections])
  const flatItems = React.useMemo(() => filteredSections.flatMap((section) => section.items), [filteredSections])
  const itemIndexes = React.useMemo(() => new Map(flatItems.map((item, index) => [item.id, index])), [flatItems])
  const [selectedIndex, setSelectedIndex] = React.useState(() => Math.max(0, flatItems.findIndex((item) => item.selected)))
  const activeItem = flatItems[selectedIndex]

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    const nextIndex = flatItems.findIndex((item) => item.selected)
    setSelectedIndex((current) => {
      if (flatItems.length === 0) {
        return 0
      }
      if (current >= 0 && current < flatItems.length) {
        return current
      }
      return nextIndex >= 0 ? nextIndex : 0
    })
  }, [flatItems])

  React.useEffect(() => {
    if (!listRef.current) {
      return
    }
    const node = listRef.current.querySelector<HTMLElement>(`[data-model-index="${selectedIndex}"]`)
    node?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  const move = React.useCallback((delta: number) => {
    setSelectedIndex((current) => clampIndex(current + delta, flatItems.length))
  }, [flatItems.length])

  const chooseActive = React.useCallback(() => {
    if (activeItem) {
      onSelect(activeItem.model)
    }
  }, [activeItem, onSelect])

  const toggleActiveFavorite = React.useCallback(() => {
    if (activeItem) {
      onToggleFavorite(activeItem.model)
    }
  }, [activeItem, onToggleFavorite])

  const cycleActiveVariant = React.useCallback(() => {
    if (activeItem) {
      onCycleVariant(activeItem.model)
    }
  }, [activeItem, onCycleVariant])

  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "n")) {
      event.preventDefault()
      move(1)
      return
    }
    if (event.key === "ArrowUp" || (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "p")) {
      event.preventDefault()
      move(-1)
      return
    }
    if (event.key === "PageDown") {
      event.preventDefault()
      move(10)
      return
    }
    if (event.key === "PageUp") {
      event.preventDefault()
      move(-10)
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
    if (event.key === "Enter") {
      event.preventDefault()
      chooseActive()
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
      return
    }
    if (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "f") {
      event.preventDefault()
      toggleActiveFavorite()
      return
    }
    if (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "t") {
      event.preventDefault()
      cycleActiveVariant()
      return
    }
    if (!event.shiftKey && !event.altKey && !event.metaKey && event.ctrlKey && event.key.toLowerCase() === "a") {
      event.preventDefault()
      onOpenProviderDocs()
    }
  }, [chooseActive, cycleActiveVariant, flatItems.length, move, onClose, onOpenProviderDocs, toggleActiveFavorite])

  if (sections.length === 0) {
    return (
      <div className="oc-modelPicker" role="dialog" aria-label={t("model.switch")} onKeyDown={onKeyDown}>
        <div className="oc-modelPickerHeader">
          <span className="oc-modelPickerTitle">{t("model.switch")}</span>
          <span className="oc-modelPickerMeta">{t("model.noneAvailable")}</span>
        </div>
        <div className="oc-modelPickerEmptyActions">
          <div className="oc-modelPickerEmptyText">{t("model.configureProvider")}</div>
          {recoveryActions.map((action) => (
            <button key={action.providerID} type="button" className="oc-modelPickerAction" onClick={() => onProviderRecovery?.(action.action)}>
              {action.actionLabel}
            </button>
          ))}
          <button type="button" className="oc-modelPickerAction" onClick={onOpenProviderDocs}>{t("model.openDocs")}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="oc-modelPicker" role="dialog" aria-label={t("model.switch")} onKeyDown={onKeyDown}>
      <div className="oc-modelPickerTop">
        <div className="oc-modelPickerHeader">
          <span className="oc-modelPickerTitle">{t("model.switch")}</span>
          <span className="oc-modelPickerMeta">{currentAgent || t("model.noAgent")}</span>
        </div>
        <div className="oc-modelPickerToolbar">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="oc-modelPickerSearch"
            placeholder={t("model.filter")}
            aria-label={t("model.filter")}
          />
        </div>
      </div>
      <div className="oc-modelPickerSections" ref={listRef}>
        {filteredSections.length > 0 ? filteredSections.map((section) => {
          return (
            <div key={section.id} className="oc-modelPickerSection">
              {!query ? <div className="oc-modelPickerSectionTitle">{section.label}{section.collapsedCount && section.collapsedCount > section.items.length ? <span className="oc-modelPickerSectionHint">{t("model.collapsed", { count: section.collapsedCount })}</span> : null}</div> : null}
              <div className="oc-modelPickerList">
                {section.items.map((item) => {
                  const index = itemIndexes.get(item.id) ?? -1
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={-1}
                      data-model-index={index}
                      className={`oc-modelPickerItem${item.selected ? " is-selected" : ""}${index === selectedIndex ? " is-active" : ""}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => onSelect(item.model)}
                    >
                      <span className="oc-modelPickerItemMain">
                        <span className="oc-modelPickerItemIdentity">
                          <span className="oc-modelPickerItemLabel">{item.modelLabel}</span>
                          <span className="oc-modelPickerItemDetail">{item.providerLabel}</span>
                        </span>
                        <span className="oc-modelPickerItemMeta">
                          {item.variant ? <span className="oc-modelPickerVariant">{item.variant}</span> : null}
                          <button
                            type="button"
                            className={`oc-modelPickerFavoriteToggle${item.favorite ? " is-favorite" : ""}`}
                            aria-label={item.favorite ? t("model.removeFavorite") : t("model.addFavorite")}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              onToggleFavorite(item.model)
                            }}
                          >
                            ★
                          </button>
                        </span>
                      </span>
                      {item.variantOptions.length > 0 ? <span className="oc-modelPickerItemHint">{t("model.cycleVariant")}</span> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }) : <div className="oc-modelPickerEmptyText">{t(toVsCodeTextKey("model.no_match"), { query })}</div>}
      </div>
    </div>
  )
}

export function filterModelPickerSections(sections: ModelPickerSection[], searchItems: ModelPickerItem[], query: string): FilteredModelPickerSection[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return sections
  }

  const items = searchItems.filter((item) => [item.modelLabel, item.providerLabel, item.variant ?? ""].join(" ").toLowerCase().includes(needle))
  if (items.length === 0) return []
  return [{
    id: "search",
    label: "",
    items,
  }]
}

function toModelPickerSection(section: ProductModelSection): ModelPickerSection {
  return {
    id: section.id,
    label: sectionLabel(section),
    items: section.items.map(toModelPickerItem),
    collapsedCount: section.collapsedCount,
  }
}

function toModelPickerItem(item: ProductModelItem): ModelPickerItem {
  return {
    id: item.id,
    providerLabel: item.provider.name || item.provider.id,
    modelLabel: item.model.name || item.model.id,
    model: item.modelRef,
    selected: item.selected,
    favorite: item.favorite,
    variant: item.variant,
    variantOptions: item.variantOptions,
  }
}

function sectionLabel(section: ProductModelSection) {
  const key = productTextKeyForModelSection(section.kind)
  if (key) return t(toVsCodeTextKey(key))
  return section.items[0]?.provider.name || section.providerID || ""
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
