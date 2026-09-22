import { describe, expect, test } from "bun:test"
import {
  MODELS_PER_PROVIDER,
  collapsedModelsHint,
  configuredModels,
  freeModelDescription,
  sortFreeModelOptions,
  modelSections,
  sortModelOptions,
  visibleProviderModels,
} from "../../../../src/component/dialog-model"

function providerModels(providerID: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    value: { providerID, modelID: `model-${index}` },
  }))
}

describe("sortModelOptions", () => {
  test("orders provider-scoped model choices by newest release first", () => {
    const sorted = sortModelOptions(
      [
        { title: "GPT 5.2", releaseDate: "2025-12-11" },
        { title: "GPT 5.4", releaseDate: "2026-03-05" },
        { title: "GPT 5.1", releaseDate: "2025-11-13" },
      ],
      true,
    )

    expect(sorted.map((model) => model.title)).toEqual(["GPT 5.4", "GPT 5.2", "GPT 5.1"])
  })

  test("orders regular model choices free-first and then newest-first", () => {
    const sorted = sortModelOptions(
      [
        { title: "GLM 5", releaseDate: "2025-07-28" },
        { title: "GLM 5.1", releaseDate: "2025-12-09" },
        { title: "GLM 5.2", releaseDate: "2026-02-16" },
        { title: "Free old", releaseDate: "2024-01-01", free: true },
        { title: "Free new", releaseDate: "2025-01-01", free: true },
      ],
      false,
    )

    expect(sorted.map((model) => model.title)).toEqual(["Free new", "Free old", "GLM 5.2", "GLM 5.1", "GLM 5"])
  })
})

describe("visibleProviderModels", () => {
  test("keeps at most the per-provider limit", () => {
    const visible = visibleProviderModels(providerModels("opencode", 8), [])

    expect(visible).toHaveLength(MODELS_PER_PROVIDER)
    expect(visible.map((option) => option.value.modelID)).toEqual([
      "model-0",
      "model-1",
      "model-2",
      "model-3",
      "model-4",
    ])
  })

  test("returns every model when the provider is below the limit", () => {
    expect(visibleProviderModels(providerModels("minimax-direct", 2), [])).toHaveLength(2)
  })

  test("removes models already shown in the favorites and recent sections", () => {
    const visible = visibleProviderModels(providerModels("opencode", 3), [
      { providerID: "opencode", modelID: "model-1" },
    ])

    expect(visible.map((option) => option.value.modelID)).toEqual(["model-0", "model-2"])
  })

  test("keeps every provider model while searching", () => {
    const visible = visibleProviderModels(
      providerModels("opencode", 8),
      [{ providerID: "opencode", modelID: "model-1" }],
      false,
    )

    expect(visible.map((option) => option.value.modelID)).toEqual([
      "model-0",
      "model-1",
      "model-2",
      "model-3",
      "model-4",
      "model-5",
      "model-6",
      "model-7",
    ])
  })
})

describe("free model options", () => {
  test("orders known free models by recommended capability", () => {
    const sorted = sortFreeModelOptions([
      { modelID: "ling-3.0-flash-fin-free", title: "Ling 3.0 Flash Fin Free" },
      { modelID: "muse-spark-1.3-contributor-free", title: "Muse Spark 1.3 Free" },
      { modelID: "mimo-v2.5-free", title: "MiMo V2.5 Free" },
    ])

    expect(sorted.map((model) => model.modelID)).toEqual([
      "muse-spark-1.3-contributor-free",
      "mimo-v2.5-free",
      "ling-3.0-flash-fin-free",
    ])
  })

  test("describes multimodal capabilities in Chinese", () => {
    expect(
      freeModelDescription({
        id: "unknown-free",
        modalities: { input: ["text", "image", "video"] },
        reasoning: true,
        tool_call: true,
        limit: { context: 200_000 },
      }, "zh"),
    ).toBe("支持文本、图片、视频输入，支持推理和工具调用，上下文 200k")

    expect(
      freeModelDescription(
        {
          id: "unknown-free",
          modalities: { input: ["text", "image", "video"] },
          reasoning: true,
          tool_call: true,
          limit: { context: 200_000 },
        },
        "en",
      ),
    ).toBe("Supports text, image, and video input, supports reasoning and tool calls, 200k context")
  })

  test("orders unknown free models by available capabilities", () => {
    const sorted = sortFreeModelOptions([
      {
        modelID: "basic-free",
        title: "Basic Free",
        info: { id: "basic-free", modalities: { input: ["text"] }, limit: { context: 32_000 } },
      },
      {
        modelID: "capable-free",
        title: "Capable Free",
        info: {
          id: "capable-free",
          reasoning: true,
          tool_call: true,
          modalities: { input: ["text", "image", "video"] },
          limit: { context: 200_000 },
        },
      },
    ])

    expect(sorted.map((model) => model.modelID)).toEqual(["capable-free", "basic-free"])
  })
})

describe("configuredModels", () => {
  test("returns only models declared under configured providers", () => {
    expect(
      configuredModels({
        model: "minimax-direct/MiniMax-M2.7",
        small_model: "minimax-direct/MiniMax-M2.7-highspeed",
        provider: {
          "minimax-direct": {
            models: {
              "MiniMax-M2.7": { name: "MiniMax M2.7" },
              "MiniMax-M2.7-highspeed": { name: "MiniMax M2.7 (highspeed)" },
            },
          },
          huggingface: {
            models: {
              "moonshotai/Kimi-K3": { name: "Kimi K3" },
            },
          },
          anthropic: {},
        },
      }),
    ).toEqual([
      { providerID: "minimax-direct", modelID: "MiniMax-M2.7" },
      { providerID: "minimax-direct", modelID: "MiniMax-M2.7-highspeed" },
      { providerID: "huggingface", modelID: "moonshotai/Kimi-K3" },
    ])
  })
})

describe("modelSections", () => {
  test("places configured models after recent models without removing semantic duplicates", () => {
    const shared = { providerID: "minimax-direct", modelID: "MiniMax-M2.7" }
    const input = {
      favorites: [shared],
      recents: [shared, { providerID: "opencode", modelID: "big-pickle" }],
      configured: [shared, { providerID: "huggingface", modelID: "moonshotai/Kimi-K3" }],
      current: { providerID: "huggingface", modelID: "Qwen/Qwen3.8-27B:featherless-ai" },
    }
    const sections = modelSections(input, "zh")

    expect(sections.map((section) => section.label)).toEqual(["收藏", "最近使用", "已配置", "当前模型"])
    expect(modelSections(input, "en").map((section) => section.label)).toEqual([
      "Favorites",
      "Recent",
      "Configured",
      "Current model",
    ])
    expect(sections.map((section) => section.models)).toEqual([
      [shared],
      [{ providerID: "opencode", modelID: "big-pickle" }],
      [shared, { providerID: "huggingface", modelID: "moonshotai/Kimi-K3" }],
      [{ providerID: "huggingface", modelID: "Qwen/Qwen3.8-27B:featherless-ai" }],
    ])
  })
})

describe("collapsedModelsHint", () => {
  test("tells the user in Chinese that more models are searchable", () => {
    const hint = collapsedModelsHint(42, "zh")

    expect(hint).toContain("42")
    expect(hint).toMatch(/\p{Script=Han}/u)
    expect(hint).not.toMatch(/search|model|models/i)
    expect(collapsedModelsHint(42, "en")).toBe("42 models; type a name to search")
  })
})
