import { describe, expect, test } from "bun:test"
import { describeFreeModel, isFreeModel, sortFreeModels } from "./free-models"

const translations = {
  "model.free.description.inputs": "支持{{inputs}}输入",
  "model.free.description.reasoningTools": "支持推理和工具调用",
  "model.free.description.reasoning": "支持推理",
  "model.free.description.tools": "支持工具调用",
  "model.free.description.context": "上下文 {{context}}",
  "model.free.description.general": "免费通用模型",
  "model.free.description.inputSeparator": "、",
  "model.free.description.separator": "，",
  "model.input.text": "文本",
  "model.input.image": "图片",
  "model.input.audio": "音频",
  "model.input.video": "视频",
  "model.input.pdf": "PDF",
} as const

const translate: Parameters<typeof describeFreeModel>[1] = (key, params) =>
  Object.entries(params ?? {}).reduce<string>(
    (value, [name, replacement]) => value.replace(`{{${name}}}`, String(replacement)),
    translations[key as keyof typeof translations] ?? key,
  )

const model = (input: Partial<Parameters<typeof sortFreeModels>[0][number]> = {}) => ({
  id: "unknown-free",
  name: "Unknown Free",
  provider: { id: "opencode" },
  cost: { input: 0, output: 0 },
  status: "active",
  reasoning: true,
  tool_call: true,
  modalities: { input: ["text"] },
  limit: { context: 128_000 },
  release_date: "2026-01-01",
  ...input,
})

describe("free model presentation", () => {
  test("only treats zero-cost OpenCode models as free", () => {
    expect(isFreeModel(model())).toBe(true)
    expect(isFreeModel(model({ provider: { id: "google" } }))).toBe(false)
    expect(isFreeModel(model({ cost: { input: 0.1, output: 0 } }))).toBe(false)
  })

  test("sorts curated models before unknown models by recommended strength", () => {
    const result = sortFreeModels([
      model({ id: "ling-3.0-flash-fin-free", name: "Ling 3.0 Flash Fin Free" }),
      model({ id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Free" }),
      model({ id: "mimo-v2.5-free", name: "MiMo V2.5 Free" }),
    ])

    expect(result.map((item) => item.id)).toEqual([
      "muse-spark-1.3-contributor-free",
      "mimo-v2.5-free",
      "ling-3.0-flash-fin-free",
    ])
  })

  test("uses a Chinese fallback description for an unknown free model", () => {
    expect(
      describeFreeModel(
        model({
          capabilities: { input: { text: true, image: true, pdf: true } },
          limit: { context: 200_000 },
        }),
        translate,
      ),
    ).toBe("支持文本、图片、PDF输入，支持推理和工具调用，上下文 200k")
  })
})
