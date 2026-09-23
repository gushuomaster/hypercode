import { createMemo, createSignal } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useLocal } from "../context/local"
import { map, pipe, flatMap, entries, filter, sortBy, take } from "remeda"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useTheme } from "../context/theme"
import { createDialogProviderOptions, DialogProvider } from "./dialog-provider"
import { DialogVariant } from "./dialog-variant"
import * as fuzzysort from "fuzzysort"
import { useConnected } from "./use-connected"
import { useSync } from "../context/sync"
import { getLocale, t, type Locale } from "../i18n"
import { useLanguage } from "../context/language"
import type { Keys } from "../i18n/en"
import { productTextKeyForModelSection, type ProductModelItem, type ProductModelSection } from "@opencode-ai/product"
import { toTuiModelCatalog } from "../product/model-adapter"
import { toTuiTextKey } from "../product/text-adapter"

type ModelRef = { providerID: string; modelID: string }

const freeModelDescriptions: Record<string, Keys> = {
  "muse-spark-1.3-contributor-free": "dialog.model.description.museSpark13",
  "mimo-v2.5-free": "dialog.model.description.mimo25",
  "kimi-k2.5-free": "dialog.model.description.kimiK25",
  "mimo-v2-omni-free": "dialog.model.description.mimoV2Omni",
  "qwen3.6-plus-free": "dialog.model.description.qwen36Plus",
  "minimax-m3-free": "dialog.model.description.minimaxM3",
  "glm-5-free": "dialog.model.description.glm5",
  "deepseek-v4-flash-free": "dialog.model.description.deepseekV4Flash",
  "nemotron-3-ultra-free": "dialog.model.description.nemotron3Ultra",
}

type FreeModelInfo = {
  id: string
  name?: string
  cost?: { input?: number }
  reasoning?: boolean
  tool_call?: boolean
  capabilities?: { reasoning?: boolean; input?: Record<string, boolean> }
  modalities?: { input?: string[] }
  limit?: { context?: number }
  status?: string
  release_date?: string
}

export function freeModelDescription(info: FreeModelInfo, locale = getLocale()) {
  const description = freeModelDescriptions[info.id]
  if (description) return t(description, undefined, locale)
  const inputKeys = {
    text: "dialog.model.input.text",
    image: "dialog.model.input.image",
    audio: "dialog.model.input.audio",
    video: "dialog.model.input.video",
    pdf: "dialog.model.input.pdf",
  } as const satisfies Record<string, Keys>
  const input = info.capabilities?.input
    ? Object.entries(info.capabilities.input)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
    : (info.modalities?.input ?? [])
  const inputs = input.map((key) => {
    const inputKey = inputKeys[key as keyof typeof inputKeys]
    return inputKey ? t(inputKey, undefined, locale) : key
  })
  const reasoning = info.reasoning ?? info.capabilities?.reasoning
  const context = info.limit?.context ? `${Math.round(info.limit.context / 1000)}k` : undefined
  const details = [
    inputs.length
      ? t("dialog.model.capability.input", { inputs: formatInputs(inputs, locale) }, locale)
      : undefined,
    reasoning && info.tool_call
      ? t("dialog.model.capability.reasoningTools", undefined, locale)
      : reasoning
        ? t("dialog.model.capability.reasoning", undefined, locale)
        : info.tool_call
          ? t("dialog.model.capability.tools", undefined, locale)
          : undefined,
    context ? t("dialog.model.capability.context", { context }, locale) : undefined,
  ].filter((item): item is string => Boolean(item))
  return details.length
    ? details.join(locale === "zh" ? "，" : ", ")
    : t("dialog.model.description.fallback", undefined, locale)
}

function formatInputs(inputs: string[], locale: Locale) {
  if (locale === "zh") return inputs.join("、")
  if (inputs.length < 2) return inputs.join("")
  if (inputs.length === 2) return inputs.join(" and ")
  return `${inputs.slice(0, -1).join(", ")}, and ${inputs.at(-1)}`
}

export function configuredModels<T extends {
  provider?: Record<string, { models?: Record<string, unknown> }>
}>(config: T): ModelRef[] {
  return Object.entries(config.provider ?? {}).flatMap(([providerID, provider]) =>
    Object.keys(provider.models ?? {}).map((modelID) => ({ providerID, modelID })),
  )
}

function isPinned(item: ModelRef, pinned: ModelRef[]) {
  return pinned.some((other) => other.providerID === item.providerID && other.modelID === item.modelID)
}

export function collapsedModelsHint(total: number, locale = getLocale()) {
  return t("dialog.model.collapsed", { count: total }, locale)
}

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const { theme } = useTheme()
  const language = useLanguage()
  const [query, setQuery] = createSignal("")

  const connected = useConnected()
  const providers = createDialogProviderOptions()

  const showExtra = createMemo(() => connected() && !props.providerID)

  const options = createMemo(() => {
    const needle = query().trim()
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()
    const configured = configuredModels(sync.data.config)
    const current = local.model.current()

    const sectionView = (label: string) => (
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
        {label}
      </text>
    )
    const catalog = showExtra()
      ? toTuiModelCatalog({
          providers: sync.data.provider,
          favorites,
          recents,
          configured,
          current,
          query: needle,
        })
      : undefined

    function sectionLabel(section: ProductModelSection) {
      const key = productTextKeyForModelSection(section.kind)
      if (key) return language.t(toTuiTextKey(key))
      return section.items[0]?.provider.name ?? section.providerID ?? ""
    }

    function toCatalogOption(item: ProductModelItem, section: ProductModelSection) {
      const provider = sync.data.provider.find((candidate) => candidate.id === item.modelRef.providerID)
      const info = provider?.models[item.modelRef.modelID]
      const label = section.kind === "search"
        ? item.provider.name ?? item.provider.id
        : sectionLabel(section)
      const categoryView =
        section.kind === "provider" && section.collapsedCount && section.collapsedCount > section.items.length ? (
          <box flexDirection="row" gap={2}>
            <text fg={theme.accent} attributes={TextAttributes.BOLD}>
              {label}
            </text>
            <text fg={theme.textMuted}>{collapsedModelsHint(section.collapsedCount, language.locale())}</text>
          </box>
        ) : (
          sectionView(label)
        )
      return {
        key: item.modelRef,
        value: item.modelRef,
        title: item.model.name ?? item.model.id,
        releaseDate: item.model.releaseDate ?? "",
        description:
          section.kind === "free" && info
            ? freeModelDescription(info, language.locale())
            : section.kind === "provider" || section.kind === "search"
              ? item.favorite
                ? `(${language.t("dialog.model.badge.favorite")})`
                : undefined
              : item.provider.name,
        category: section.kind === "provider" || section.kind === "search" ? label : `model-section:${section.kind}`,
        categoryView,
        disabled: item.provider.id === "opencode" && item.model.id.includes("-nano"),
        free: item.model.free,
        footer: item.model.free ? language.t("dialog.model.badge.free") : undefined,
        onSelect: () => onSelect(item.modelRef.providerID, item.modelRef.modelID),
      }
    }

    const catalogOptions = catalog?.sections.flatMap((section) =>
      section.items.map((item) => toCatalogOption(item, section)),
    ) ?? []
    const providerOptions = catalog ? [] : pipe(
      sync.data.provider,
      sortBy(
        (provider) => provider.id !== "opencode",
        (provider) => provider.name,
      ),
      flatMap((provider) => {
        const models = pipe(
          provider.models,
          entries(),
          filter(([_, info]) => info.status !== "deprecated"),
          filter(([_, info]) => (props.providerID ? info.providerID === props.providerID : true)),
          filter(([_, info]) => !(catalog && provider.id === "opencode" && (!info.cost || info.cost.input === 0))),
          map(([model, info]) => ({
            value: { providerID: provider.id, modelID: model },
            title: info.name ?? model,
            releaseDate: info.release_date,
            description: isPinned({ providerID: provider.id, modelID: model }, favorites)
              ? `(${language.t("dialog.model.badge.favorite")})`
              : undefined,
            category: connected() ? provider.name : undefined,
            disabled: provider.id === "opencode" && model.includes("-nano"),
            free: info.cost?.input === 0 && provider.id === "opencode",
            footer:
              info.cost?.input === 0 && provider.id === "opencode"
                ? language.t("dialog.model.badge.free")
                : undefined,
            onSelect() {
              onSelect(provider.id, model)
            },
          })),
          (options) => sortModelOptions(options, props.providerID !== undefined),
        )
        return models
      }),
    )

    const popularProviders = !connected()
      ? pipe(
          providers(),
          map((option) => ({
            ...option,
            category: language.t("dialog.model.category.popularProviders"),
          })),
          take(6),
        )
      : []

    if (needle && catalog) {
      return [
        ...catalogOptions,
        ...fuzzysort.go(needle, popularProviders, { keys: ["title"] }).map((result) => result.obj),
      ]
    }

    if (needle) {
      return [
        ...sortModelOptions(
          fuzzysort.go(needle, providerOptions, { keys: ["title", "category"] }).map((result) => result.obj),
          false,
        ),
        ...fuzzysort.go(needle, popularProviders, { keys: ["title"] }).map((result) => result.obj),
      ]
    }

    return [
      ...catalogOptions,
      ...providerOptions,
      ...popularProviders,
    ]
  })

  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((item) => item.id === props.providerID) : null,
  )

  const title = createMemo(() => {
    const value = provider()
    if (!value) return language.t("dialog.model.title")
    return value.name
  })

  function onSelect(providerID: string, modelID: string) {
    local.model.set({ providerID, modelID }, { recent: true })
    const list = local.model.variant.list()
    const cur = local.model.variant.selected()
    if (cur === "default" || (cur && list.includes(cur))) {
      dialog.clear()
      return
    }
    if (list.length > 0) {
      dialog.replace(() => <DialogVariant />)
      return
    }
    dialog.clear()
  }

  return (
    <DialogSelect<ReturnType<typeof options>[number]["value"]>
      options={options()}
      actions={[
        {
          command: "model.dialog.provider",
          title: connected()
            ? language.t("dialog.model.action.connectProvider")
            : language.t("dialog.model.action.viewProviders"),
          onTrigger() {
            dialog.replace(() => <DialogProvider />)
          },
        },
        {
          command: "model.dialog.favorite",
          title: language.t("dialog.model.action.favorite"),
          hidden: !connected(),
          onTrigger: (option) => {
            local.model.toggleFavorite(option.value as { providerID: string; modelID: string })
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={local.model.current()}
    />
  )
}

export function sortModelOptions<T extends { free?: boolean; releaseDate: string | number; title: string }>(
  options: T[],
  newestFirst: boolean,
) {
  if (newestFirst) return sortBy(options, [(option) => option.releaseDate, "desc"], (option) => option.title)
  return sortBy(
    options,
    (option) => !option.free,
    [(option) => option.releaseDate, "desc"],
    (option) => option.title,
  )
}
