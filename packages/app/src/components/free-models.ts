type FreeModelInput = {
  provider: { id: string }
  cost?: { input?: number; output?: number }
  id: string
  name: string
  status?: string
  reasoning?: boolean
  tool_call?: boolean
  capabilities?: {
    reasoning?: boolean
    input?: Record<string, boolean>
  }
  modalities?: { input?: string[] }
  limit?: { context?: number }
  release_date?: string
}

const recommendedOrder = [
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

const recommendedRank = new Map(recommendedOrder.map((id, index) => [id, recommendedOrder.length - index]))

const inputLabelKeys = {
  text: "model.input.text",
  image: "model.input.image",
  audio: "model.input.audio",
  video: "model.input.video",
  pdf: "model.input.pdf",
} as const

const descriptionKeys = {
  "muse-spark-1.3-contributor-free": "model.free.description.museSpark13",
  "mimo-v2.5-free": "model.free.description.mimoV25",
  "kimi-k2.5-free": "model.free.description.kimiK25",
  "mimo-v2-omni-free": "model.free.description.mimoV2Omni",
  "qwen3.6-plus-free": "model.free.description.qwen36Plus",
  "minimax-m3-free": "model.free.description.minimaxM3",
  "glm-5-free": "model.free.description.glm5",
  "deepseek-v4-flash-free": "model.free.description.deepseekV4Flash",
  "nemotron-3-ultra-free": "model.free.description.nemotron3Ultra",
  "muse-spark-1.2-contributor-free": "model.free.description.museSpark12",
  "x-preview-f-free": "model.free.description.xPreviewF",
  "minimax-m2.5-free": "model.free.description.minimaxM25",
  "mimo-v2-pro-free": "model.free.description.mimoV2Pro",
  "glm-4.7-free": "model.free.description.glm47",
  "nemotron-3-super-free": "model.free.description.nemotron3Super",
  "nemotron-3.5-lightning-free": "model.free.description.nemotron35Lightning",
  "minimax-m2.1-free": "model.free.description.minimaxM21",
  "longcat-2.0-free": "model.free.description.longcat20",
  "hy3-free": "model.free.description.hy3",
  "hy3-preview-free": "model.free.description.hy3Preview",
  "north-mini-code-free": "model.free.description.northMiniCode",
  "grok-code": "model.free.description.grokCode",
  "ring-2.6-1t-free": "model.free.description.ring26",
  "mimo-v2-flash-free": "model.free.description.mimoV2Flash",
  "trinity-large-preview-free": "model.free.description.trinityLargePreview",
  "big-pickle": "model.free.description.bigPickle",
  "ling-3.0-flash-fin-free": "model.free.description.ling30FlashFin",
  "ling-3.0-flash-free": "model.free.description.ling30Flash",
  "ling-2.6-flash-free": "model.free.description.ling26Flash",
  "ling-3.0-tiny-free": "model.free.description.ling30Tiny",
  "laguna-s-2.1-free": "model.free.description.lagunaS21",
} as const

type DescriptionKey =
  | (typeof descriptionKeys)[keyof typeof descriptionKeys]
  | (typeof inputLabelKeys)[keyof typeof inputLabelKeys]
  | "model.free.description.inputs"
  | "model.free.description.reasoningTools"
  | "model.free.description.reasoning"
  | "model.free.description.tools"
  | "model.free.description.context"
  | "model.free.description.general"
  | "model.free.description.inputSeparator"
  | "model.free.description.separator"

type Translate = (key: DescriptionKey, params?: Record<string, string | number | boolean>) => string

export function isFreeModel(model: FreeModelInput) {
  return model.provider.id === "opencode" && (!model.cost || model.cost.input === 0)
}

export function sortFreeModels<T extends FreeModelInput>(models: readonly T[]) {
  return [...models].sort((left, right) => score(right) - score(left) || left.name.localeCompare(right.name))
}

export function describeFreeModel(model: FreeModelInput, translate: Translate) {
  const descriptionKey = descriptionKeys[model.id as keyof typeof descriptionKeys]
  if (descriptionKey) return translate(descriptionKey)
  const inputs = model.capabilities?.input
    ? Object.entries(model.capabilities.input)
        .filter(([, enabled]) => enabled)
        .map(([key]) => {
          const label = inputLabelKeys[key as keyof typeof inputLabelKeys]
          return label ? translate(label) : key
        })
    : (model.modalities?.input ?? []).map((key) => {
        const label = inputLabelKeys[key as keyof typeof inputLabelKeys]
        return label ? translate(label) : key
      })
  const reasoning = model.reasoning ?? model.capabilities?.reasoning
  const toolCall = model.tool_call
  const context = model.limit?.context ? `${Math.round(model.limit.context / 1000)}k` : undefined
  const details = [
    inputs.length
      ? translate("model.free.description.inputs", {
          inputs: inputs.join(translate("model.free.description.inputSeparator")),
        })
      : undefined,
    reasoning && toolCall
      ? translate("model.free.description.reasoningTools")
      : reasoning
        ? translate("model.free.description.reasoning")
        : toolCall
          ? translate("model.free.description.tools")
          : undefined,
    context ? translate("model.free.description.context", { context }) : undefined,
  ].filter((item): item is string => Boolean(item))
  return details.length
    ? details.join(translate("model.free.description.separator"))
    : translate("model.free.description.general")
}

function score(model: FreeModelInput) {
  const curated = recommendedRank.get(model.id)
  if (curated) return 10_000 + curated

  const inputs = model.capabilities?.input
    ? Object.entries(model.capabilities.input)
        .filter(([, enabled]) => enabled)
        .map(([input]) => input)
    : (model.modalities?.input ?? [])
  const reasoning = model.reasoning ?? model.capabilities?.reasoning
  const context = model.limit?.context ?? 0
  const release = Date.parse(model.release_date ?? "")
  return (
    (model.status === "active" ? 1_000 : model.status === "deprecated" ? 0 : 500) +
    (reasoning ? 200 : 0) +
    (model.tool_call ? 100 : 0) +
    inputs.filter((input) => input !== "text").length * 50 +
    Math.min(context / 10_000, 100) +
    (Number.isFinite(release) ? release / 1e12 : 0)
  )
}
