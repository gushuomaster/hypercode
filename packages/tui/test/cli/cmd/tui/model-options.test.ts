import { describe, expect, test } from "bun:test"
import {
  collapsedModelsHint,
  configuredModels,
  freeModelDescription,
  sortModelOptions,
} from "../../../../src/component/dialog-model"

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

describe("free model options", () => {
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

describe("collapsedModelsHint", () => {
  test("tells the user in Chinese that more models are searchable", () => {
    const hint = collapsedModelsHint(42, "zh")

    expect(hint).toContain("42")
    expect(hint).toMatch(/\p{Script=Han}/u)
    expect(hint).not.toMatch(/search|model|models/i)
    expect(collapsedModelsHint(42, "en")).toBe("42 models; type a name to search")
  })
})
