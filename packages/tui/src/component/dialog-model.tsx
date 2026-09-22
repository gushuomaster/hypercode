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

export const MODELS_PER_PROVIDER = 5

type ModelRef = { providerID: string; modelID: string }

const freeModelOrder = [
  "muse-spark-1.3-contributor-free",
  "mimo-v2.5-free",
  "kimi-k2.5-free",
  "mimo-v2-omni-free",
  "qwen3.6-plus-free",
  "minimax-m3-free",
  "glm-5-free",
  "deepseek-v4-flash-free",
  "nemotron-3-ultra-free",
  "muse-spark-1.2-contributor-free",
  "x-preview-f-free",
  "minimax-m2.5-free",
  "mimo-v2-pro-free",
  "glm-4.7-free",
  "nemotron-3-super-free",
  "nemotron-3.5-lightning-free",
  "minimax-m2.1-free",
  "longcat-2.0-free",
  "hy3-free",
  "hy3-preview-free",
  "north-mini-code-free",
  "grok-code",
  "ring-2.6-1t-free",
  "mimo-v2-flash-free",
  "trinity-large-preview-free",
  "big-pickle",
  "ling-3.0-flash-fin-free",
  "ling-3.0-flash-free",
  "ling-2.6-flash-free",
  "ling-3.0-tiny-free",
  "laguna-s-2.1-free",
]
const freeModelRank = new Map(freeModelOrder.map((id, index) => [id, freeModelOrder.length - index]))
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

export function sortFreeModelOptions<T extends { modelID: string; title: string; info?: FreeModelInfo }>(options: T[]) {
  return [...options].sort(
    (left, right) =>
      freeModelScore(right.modelID, right.info) - freeModelScore(left.modelID, left.info) ||
      left.title.localeCompare(right.title),
  )
}

function freeModelScore(modelID: string, info?: FreeModelInfo) {
  const curated = freeModelRank.get(modelID)
  if (curated !== undefined) return 10_000 + curated

  const inputs = info?.capabilities?.input
    ? Object.entries(info.capabilities.input)
        .filter(([, enabled]) => enabled)
        .map(([input]) => input)
    : (info?.modalities?.input ?? [])
  const release = Date.parse(info?.release_date ?? "")
  return (
    (info?.status === "active" ? 1_000 : info?.status === "deprecated" ? 0 : 500) +
    (info?.reasoning ?? info?.capabilities?.reasoning ? 200 : 0) +
    (info?.tool_call ? 100 : 0) +
    inputs.filter((input) => input !== "text").length * 50 +
    Math.min((info?.limit?.context ?? 0) / 10_000, 100) +
    (Number.isFinite(release) ? release / 1e12 : 0)
  )
}

export function configuredModels<T extends {
  provider?: Record<string, { models?: Record<string, unknown> }>
}>(config: T): ModelRef[] {
  return Object.entries(config.provider ?? {}).flatMap(([providerID, provider]) =>
    Object.keys(provider.models ?? {}).map((modelID) => ({ providerID, modelID })),
  )
}

export function modelSections(input: {
  favorites: ModelRef[]
  recents: ModelRef[]
  configured: ModelRef[]
  current?: ModelRef
}, locale = getLocale()): { category: string; label: string; models: ModelRef[] }[] {
  return [
    {
      category: "model-section:favorites",
      label: t("dialog.model.section.favorites", undefined, locale),
      models: input.favorites,
    },
    {
      category: "model-section:recent",
      label: t("dialog.model.section.recent", undefined, locale),
      models: input.recents.filter((item) => !isPinned(item, input.favorites)),
    },
    {
      category: "model-section:configured",
      label: t("dialog.model.section.configured", undefined, locale),
      models: input.configured,
    },
    {
      category: "model-section:current",
      label: t("dialog.model.section.current", undefined, locale),
      models:
        input.current && !isPinned(input.current, [...input.favorites, ...input.recents, ...input.configured])
          ? [input.current]
          : [],
    },
  ]
}

function isPinned(item: ModelRef, pinned: ModelRef[]) {
  return pinned.some((other) => other.providerID === item.providerID && other.modelID === item.modelID)
}

export function visibleProviderModels<T extends { value: ModelRef }>(
  models: T[],
  pinned: ModelRef[],
  showSections = true,
): T[] {
  if (!showSections) return models
  return models.filter((option) => !isPinned(option.value, pinned)).slice(0, MODELS_PER_PROVIDER)
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
    const showSections = showExtra() && needle.length === 0
    const showFreeModels = !props.providerID && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()
    const configured = configuredModels(sync.data.config)
    const current = local.model.current()
    const pinned = current ? [...favorites, ...recents, ...configured, current] : [...favorites, ...recents, ...configured]

    function toOptions(items: typeof favorites, category: string, categoryView?: ReturnType<typeof sectionView>) {
      if (!showSections) return []
      return items.flatMap((item) => {
        const provider = sync.data.provider.find((provider) => provider.id === item.providerID)
        if (!provider) return []
        const model = provider.models[item.modelID]
        if (!model) return []
        return [
          {
            key: item,
            value: { providerID: provider.id, modelID: model.id },
            title: model.name ?? item.modelID,
            description: provider.name,
            category,
            categoryView,
            disabled: provider.id === "opencode" && model.id.includes("-nano"),
            free: model.cost?.input === 0 && provider.id === "opencode",
            footer:
              model.cost?.input === 0 && provider.id === "opencode"
                ? language.t("dialog.model.badge.free")
                : undefined,
            onSelect: () => {
              onSelect(provider.id, model.id)
            },
          },
        ]
      })
    }

    const sectionView = (label: string) => (
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
        {label}
      </text>
    )
    const sectionOptions = modelSections(
      { favorites, recents, configured, current },
      language.locale(),
    ).flatMap((section) => toOptions(section.models, section.category, sectionView(section.label)))
    const freeOptions = showFreeModels
      ? sortFreeModelOptions(
          Object.entries(sync.data.provider.find((provider) => provider.id === "opencode")?.models ?? {})
            .filter(([, info]) => !info.cost || info.cost.input === 0)
            .map(([modelID, info]) => ({
              key: { providerID: "opencode", modelID },
              value: { providerID: "opencode", modelID },
              modelID,
              title: info.name ?? modelID,
              description: freeModelDescription(info, language.locale()),
              category: "model-section:free",
              categoryView: sectionView(language.t("dialog.model.section.free")),
              disabled: modelID.includes("-nano"),
              free: true,
              footer: language.t("dialog.model.badge.free"),
              onSelect: () => onSelect("opencode", modelID),
              info,
            })),
        )
      : []

    const providerOptions = pipe(
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
          filter(([model, info]) => !(showFreeModels && provider.id === "opencode" && (!info.cost || info.cost.input === 0))),
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
        const shown = visibleProviderModels(models, pinned, showSections)
        if (shown.length === models.length) return shown
        return shown.map((option, index) =>
          index === 0
            ? {
                ...option,
                categoryView: (
                  <box flexDirection="row" gap={2}>
                    <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                      {provider.name}
                    </text>
                    <text fg={theme.textMuted}>{collapsedModelsHint(models.length, language.locale())}</text>
                  </box>
                ),
              }
            : option,
        )
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

    if (needle) {
      return [
        ...sortModelOptions(
          fuzzysort.go(needle, providerOptions, { keys: ["title", "category"] }).map((x) => x.obj),
          false,
        ),
        ...fuzzysort.go(needle, popularProviders, { keys: ["title"] }).map((x) => x.obj),
      ]
    }

    return [
      ...sectionOptions,
      ...freeOptions,
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
